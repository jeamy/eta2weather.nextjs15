'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { EtaPos, EtaText, EtaButtons } from '@/reader/functions/types-constants/EtaConstants';
import Image from 'next/image';
import { API } from '@/constants/apiPaths';
import { useToast } from '@/components/ToastProvider';

interface DisplayEtaValue {
  short: string;
  long: string;
  strValue: string;
  unit: string;
}

type DisplayDataType = {
  [key: string]: DisplayEtaValue;
};

const EtaData: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config.data);
  const etaState = useSelector((state: RootState) => state.eta);
  const [loadingState, setLoadingState] = useState({ isLoading: false, error: '' });
  // Prevent overlapping update operations
  const updateBusyRef = useRef<boolean>(false);

  const [displayData, setDisplayData] = useState<DisplayDataType | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [overrideActive, setOverrideActive] = useState<boolean>(false);
  const [overrideRemainingMs, setOverrideRemainingMs] = useState<number>(0);
  const { showToast } = useToast();
  const lastTempState = useRef<{
    manualOverride: boolean;
    manualOverrideTime: number | null;
  }>({
    manualOverride: false,
    manualOverrideTime: null
  });

  // Memoized map of button short codes to their URIs
  const buttonIds = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (!etaState.data) return map;
    Object.entries(etaState.data).forEach(([uri, data]) => {
      if (Object.values(EtaButtons).includes(data.short as EtaButtons)) {
        map[data.short ?? ''] = uri;
      }
    });
    return map;
  }, [etaState.data]);

  // ETA data is now loaded centrally by BackgroundSync
  // This component only reads from Redux store

  const updateLocalState = useCallback((uri: string, value: EtaPos) => {
    if (!etaState.data?.[uri]) return;

    dispatch(storeEtaData({
      ...etaState.data,
      [uri]: {
        ...etaState.data[uri],
        value
      }
    }));
  }, [dispatch, etaState.data]);

  const updateButtonStates = useCallback(async (activeButton: EtaButtons, isManual: boolean = false) => {
    try {
      // Debounce concurrent operations
      if (updateBusyRef.current) return;
      updateBusyRef.current = true;
      setIsUpdating(true);

      // No-op if already active
      const currentActive = (() => {
        for (const [, data] of Object.entries(etaState.data)) {
          if (Object.values(EtaButtons).includes(data.short as EtaButtons) && data.value === EtaPos.EIN) {
            return data.short as EtaButtons;
          }
        }
        return null;
      })();
      if (currentActive === activeButton) {
        return;
      }
      if (!buttonIds[activeButton]) {
        console.warn(`Button ID not found for ${activeButton}`);
        setLoadingState(prev => ({ ...prev, error: `Button ID not found for ${activeButton}` }));
        return;
      }

      const activeFlags = Object.fromEntries(
        Object.entries(buttonIds).map(([button, uri]) => [button, etaState.data[uri]?.value === EtaPos.EIN])
      );

      const response = await fetch(API.ETA_HEATING_MODE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetButton: activeButton,
          activeFlags,
          isManual
        })
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch { /* ignore */ }
        throw new Error(`Failed to update heating mode ${activeButton}: ${errorMessage}`);
      }

      for (const [button, uri] of Object.entries(buttonIds)) {
        if (Object.values(EtaButtons).includes(button as EtaButtons)) {
          updateLocalState(uri, button === activeButton ? EtaPos.EIN : EtaPos.AUS);
        }
      }

      // Data will be refreshed automatically by BackgroundSync
    } catch (error) {
      console.error('Error updating button states:', error);
      setLoadingState(prev => ({ ...prev, error: (error as Error).message }));
    } finally {
      updateBusyRef.current = false;
      setIsUpdating(false);
    }
  }, [etaState.data, buttonIds, updateLocalState]);

  // Get the currently active button from etaState
  const getActiveButton = useCallback(() => {
    for (const [uri, data] of Object.entries(etaState.data)) {
      if (Object.values(EtaButtons).includes(data.short as EtaButtons) && data.value === EtaPos.EIN) {
        return data.short as EtaButtons;
      }
    }
    return null;
  }, [etaState.data]);

  // Current active button (for segmented control state)
  const activeKey = getActiveButton();

  // (Removed duplicate temperature control effect; consolidated below)

  // Update display data when etaState changes
  useEffect(() => {
    if (!etaState.data) return;

    const newDisplayData: DisplayDataType = {};

    Object.values(etaState.data).forEach(entry => {
      if (Object.values(EtaButtons).includes(entry.short as EtaButtons)) {
        // console.log(`Processing button ${entry.short}: value=${entry.value}, strValue=${entry.strValue}`);
        newDisplayData[entry.short || ' '] = {
          short: entry.short || 'Unknown',
          long: entry.long || entry.short || 'Unknown',
          strValue: entry.value === EtaPos.EIN ? EtaText.EIN : EtaText.AUS,
          unit: entry.unit || ''
        };
      }
    });

    // Only update if the data has actually changed
    setDisplayData(prevData => {
      if (!prevData) return newDisplayData;

      // Check if any values have changed
      const hasChanges = Object.entries(newDisplayData).some(([key, value]) => {
        return !prevData[key] || prevData[key].strValue !== value.strValue;
      });

      return hasChanges ? newDisplayData : prevData;
    });
  }, [etaState.data]);

  const handleButtonClick = useCallback(async (clickedButton: EtaButtons) => {
    // Set manual override when a button is clicked, except for AA
    if (clickedButton !== EtaButtons.AA) {
      lastTempState.current.manualOverride = true;
      lastTempState.current.manualOverrideTime = Date.now();
      const overrideMs = parseInt(config.t_override, 10) || 60 * 60 * 1000;
      const overrideMinutes = Math.round(overrideMs / 60000);
      console.log(`Manual override activated for ${overrideMinutes} minutes`);
      // Immediate UI feedback
      setOverrideActive(true);
      setOverrideRemainingMs(overrideMs);
    }

    try {
      await updateButtonStates(clickedButton, true);
      const label = (() => {
        switch (clickedButton) {
          case EtaButtons.AA: return 'Auto aktiviert';
          case EtaButtons.HT: return 'Heizen aktiviert';
          case EtaButtons.KT: return 'Kommen aktiviert';
          case EtaButtons.DT: return 'Absenken aktiviert';
          case EtaButtons.GT: return 'Gehen aktiviert';
          default: return 'Aktualisiert';
        }
      })();
      showToast(label, 'success');
    } catch (error) {
      console.error('Error handling button click:', error);
      showToast(error instanceof Error ? error.message : 'Aktion fehlgeschlagen', 'error');
    }
  }, [updateButtonStates, config.t_override]);

  // Countdown for manual override; updates every second
  useEffect(() => {
    const interval = setInterval(() => {
      const timeoutMs = parseInt(config.t_override, 10) || 60 * 60 * 1000;
      if (lastTempState.current.manualOverride && lastTempState.current.manualOverrideTime) {
        const elapsed = Date.now() - lastTempState.current.manualOverrideTime;
        const remaining = Math.max(0, timeoutMs - elapsed);
        setOverrideActive(remaining > 0);
        setOverrideRemainingMs(remaining);
      } else {
        setOverrideActive(false);
        setOverrideRemainingMs(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [config.t_override]);

  const cancelOverride = useCallback(async () => {
    try {
      lastTempState.current.manualOverride = false;
      lastTempState.current.manualOverrideTime = null;
      setOverrideActive(false);
      setOverrideRemainingMs(0);
      await updateButtonStates(EtaButtons.AA, true);
      showToast('Override beendet · Auto aktiviert', 'success');
    } catch (e) {
      console.error('Error cancelling manual override:', e);
      showToast(e instanceof Error ? e.message : 'Override beenden fehlgeschlagen', 'error');
    }
  }, [updateButtonStates]);

  useEffect(() => {
    // t_override is stored in milliseconds (ms); default to 60 minutes if not set
    const overrideTimeoutMs = parseInt(config.t_override, 10) || 60 * 60 * 1000;
    const overrideTimeoutMinutes = Math.round(overrideTimeoutMs / 60000);

    if (lastTempState.current.manualOverride && lastTempState.current.manualOverrideTime) {
      const now = Date.now();
      if (now - lastTempState.current.manualOverrideTime >= overrideTimeoutMs) {
        console.log(`Manual override timeout (${overrideTimeoutMinutes} minutes) reached, resuming automatic temperature control`);
        lastTempState.current.manualOverride = false;
        lastTempState.current.manualOverrideTime = null;
      }
    }
  }, [config.t_override]); // Re-run when override timeout changes

  // Periodic refresh is now handled by BackgroundSync - no need for interval here

  if (loadingState.isLoading) {
    return (
      <div className="card">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line" />
      </div>
    );
  }

  if (loadingState.error) {
    return (
      <div className="alert alert--error">
        <p>Error loading data: {loadingState.error}</p>
      </div>
    );
  }

  // Do not hard-fail when ETA store is briefly empty (e.g., during background refresh).
  // Keep rendering with last known displayData or show skeleton if still loading.

  if (!displayData) {
    return (
      <div className="card">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col items-center mb-4 card__header">
        <div className="h-[150px] w-full relative flex items-center justify-center">
          <Image
            src="/eta-logo.png"
            alt="ETA"
            width={100}
            height={100}
            style={{ objectFit: 'contain', width: 'auto', height: 'auto' }}
            priority
          />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold">ETA Data</h2>
      </div>
      {overrideActive && (
        <div className="alert alert--warning mb-3 flex items-center justify-between">
          <span>
            Manual override aktiv – Restzeit {(() => {
              const total = Math.max(0, overrideRemainingMs);
              const mm = Math.floor(total / 60000);
              const ss = Math.floor((total % 60000) / 1000).toString().padStart(2, '0');
              return `${mm}:${ss} min`;
            })()}
          </span>
          <button
            onClick={cancelOverride}
            disabled={isUpdating}
            className={`btn btn--ghost ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Override beenden"
          >
            Override beenden
          </button>
        </div>
      )}

      {/* Quick actions: segmented on ≥sm, dropdown on mobile */}
      <div className="mb-3">
        <div className="hidden sm:block">
          <div className="segmented" role="radiogroup" aria-label="Schnellaktionen">
            {[
              { key: EtaButtons.AA, label: 'Auto' },
              { key: EtaButtons.HT, label: 'Heizen' },
              { key: EtaButtons.KT, label: 'Kommen' },
              { key: EtaButtons.DT, label: 'Absenken' },
              { key: EtaButtons.GT, label: 'Gehen' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`segmented__option ${activeKey === key ? 'segmented__option--active' : ''} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-checked={activeKey === key}
                role="radio"
                onClick={() => { if (!isUpdating) handleButtonClick(key); }}
                disabled={isUpdating}
                title={label}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="segmented__dropdown sm:hidden">
          <div className="segmented__dropdown-label">Schnellaktionen</div>
          <label htmlFor="quick-actions" className="sr-only">Schnellaktionen</label>
          <select
            id="quick-actions"
            value={activeKey || EtaButtons.AA}
            onChange={(e) => handleButtonClick(e.target.value as EtaButtons)}
            disabled={isUpdating}
          >
            {[
              { key: EtaButtons.AA, label: 'Auto' },
              { key: EtaButtons.HT, label: 'Heizen' },
              { key: EtaButtons.KT, label: 'Kommen' },
              { key: EtaButtons.DT, label: 'Absenken' },
              { key: EtaButtons.GT, label: 'Gehen' },
            ].map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      {(etaState.data && Object.keys(etaState.data).length > 0) || displayData ? (
        <div className="space-y-3 text-sm sm:text-base">
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(etaState.data || {})
              .filter(([_, value]) => {
                // Filter out button entries only; allow entries even if strValue is empty
                if (Object.values(EtaButtons).includes(value.short as EtaButtons)) {
                  return false;
                }
                const hasText = !!(value.strValue && value.strValue.trim() !== '');
                const hasNumeric = (() => {
                  const raw: any = (value as any).value;
                  return raw !== undefined && raw !== null && String(raw).trim() !== '';
                })();
                return hasText || hasNumeric;
              })
              .sort(([_, a], [__, b]) => {
                const order: Record<string, number> = {
                  SP: 1, AT: 2, KZ: 3, VT: 4, HK: 5,
                  IP: 6, VR: 7, SZ: 8, EAT: 9
                };
                const aShort = a.short || '';
                const bShort = b.short || '';
                const aOrder = aShort in order ? order[aShort] : 99;
                const bOrder = bShort in order ? order[bShort] : 99;
                return aOrder - bOrder;
              })
              .map(([key, value]) => {
                const text = (value.strValue && value.strValue.trim() !== '')
                  ? value.strValue
                  : (() => {
                    const raw: any = (value as any).value;
                    return raw !== undefined && raw !== null ? String(raw) : '--';
                  })();
                return (
                  <div key={key} className="flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{value.long}:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge--neutral">
                          {text}{value.unit && <span>&nbsp;{value.unit}</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            {/* If etaState.data is empty but we have displayData, show a message */}
            {(!etaState.data || Object.keys(etaState.data).length === 0) && displayData && (
              <div className="text-center text-gray-500 py-4">
                <p>Daten werden aktualisiert...</p>
              </div>
            )}
            {/* Render switches separately */}
            {Object.values(EtaButtons).map(key => {
              const value = displayData[key] || { short: key, long: '', strValue: '', unit: '' };
              return (
                <div key={key} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {key === EtaButtons.HT ? 'Heizen Taste' :
                          key === EtaButtons.AA ? 'Autotaste' :
                            key === EtaButtons.DT ? 'Absenken Taste' :
                              key === EtaButtons.GT ? 'Gehen Taste' :
                                key === EtaButtons.KT ? 'Kommen Taste' :
                                  value.long}:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${value.strValue === EtaText.EIN ? 'badge--ok' :
                        value.strValue === EtaText.AUS ? 'badge--error' :
                          'badge--neutral'
                        }`}>
                        {value.strValue}
                      </span>
                      <button
                        onClick={() => {
                          if (!isUpdating && isHeatingKey(key)) {
                            handleButtonClick(key);
                          }
                        }}
                        disabled={isUpdating}
                        className={`switch ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        role="switch"
                        aria-checked={value.strValue === EtaText.EIN}
                        aria-busy={isUpdating}
                        title={`Toggle ${value.long}`}
                      >
                        <span className="sr-only">Toggle {value.long}</span>
                        <span className="switch__thumb" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center min-h-[200px]">
          <p>Loading...</p>
        </div>
      )}
    </div>
  );
};

type HeatingKey = EtaButtons;

const isHeatingKey = (key: string): key is HeatingKey => {
  return Object.values(EtaButtons).includes(key as EtaButtons);
};

export default EtaData;
