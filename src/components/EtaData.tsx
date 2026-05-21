'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { EtaPos, EtaText, EtaButtons } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import Image from 'next/image';
import { API } from '@/constants/apiPaths';
import { useToast } from '@/components/ToastProvider';

const ETA_DISPLAY_ORDER: Partial<Record<EtaConstants, number>> = {
  [EtaConstants.SCHIEBERPOS]: 1,
  [EtaConstants.AUSSENTEMP]: 2,
  [EtaConstants.KESSELTEMP]: 3,
  [EtaConstants.VORLAUFTEMP]: 4,
  [EtaConstants.HEIZKURVE]: 5,
  [EtaConstants.INHALT_PELLETS_BEHALTER]: 6,
  [EtaConstants.VORRAT]: 7,
  [EtaConstants.SCHALTZUSTAND]: 8,
  [EtaConstants.EIN_AUS_TASTE]: 9,
};

const ETA_DISPLAY_SHORTS = new Set<string>(Object.keys(ETA_DISPLAY_ORDER));
const ETA_BUTTON_OPTIONS = [
  { key: EtaButtons.EAT, label: 'Ein/Aus', longLabel: 'Ein/Aus Taste' },
  { key: EtaButtons.HT, label: 'Heizen', longLabel: 'Heizen Taste' },
  { key: EtaButtons.KT, label: 'Kommen', longLabel: 'Kommen Taste' },
  { key: EtaButtons.AA, label: 'Auto', longLabel: 'Autotaste' },
  { key: EtaButtons.GT, label: 'Gehen', longLabel: 'Gehen Taste' },
  { key: EtaButtons.DT, label: 'Absenken', longLabel: 'Absenken Taste' },
] as const;
const ETA_BUTTON_KEYS = ETA_BUTTON_OPTIONS.map(option => option.key);
const ETA_BUTTON_LABELS = Object.fromEntries(
  ETA_BUTTON_OPTIONS.map(option => [option.key, option.longLabel])
) as Record<EtaButtons, string>;

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

      const nextEtaData = { ...etaState.data };
      for (const [button, uri] of Object.entries(buttonIds)) {
        if (!isHeatingKey(button) || !nextEtaData[uri]) {
          continue;
        }
        const isActive = button === activeButton;
        nextEtaData[uri] = {
          ...nextEtaData[uri],
          value: isActive ? EtaPos.EIN : EtaPos.AUS,
          strValue: isActive ? EtaText.EIN : EtaText.AUS,
        };
      }
      dispatch(storeEtaData(nextEtaData));

      // Data will be refreshed automatically by BackgroundSync
    } catch (error) {
      console.error('Error updating button states:', error);
      setLoadingState(prev => ({ ...prev, error: (error as Error).message }));
    } finally {
      updateBusyRef.current = false;
      setIsUpdating(false);
    }
  }, [dispatch, etaState.data, buttonIds]);

  // Get the currently active button from etaState
  const getActiveButton = useCallback(() => {
    for (const key of ETA_BUTTON_KEYS.filter(key => key !== EtaButtons.AA)) {
      const uri = buttonIds[key];
      const data = uri ? etaState.data[uri] : undefined;
      if (data?.value === EtaPos.EIN) {
        return key;
      }
    }

    const autoUri = buttonIds[EtaButtons.AA];
    if (autoUri && etaState.data[autoUri]?.value === EtaPos.EIN) {
      return EtaButtons.AA;
    }

    for (const [, data] of Object.entries(etaState.data)) {
      if (Object.values(EtaButtons).includes(data.short as EtaButtons) && data.value === EtaPos.EIN) {
        return data.short as EtaButtons;
      }
    }
    return EtaButtons.AA;
  }, [buttonIds, etaState.data]);

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
          case EtaButtons.EAT: return 'Ein/Aus aktiviert';
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
            {ETA_BUTTON_OPTIONS.map(({ key, label }) => (
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
            {ETA_BUTTON_OPTIONS.map(({ key, label }) => (
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
                if (Object.values(EtaButtons).includes(value.short as EtaButtons)) {
                  return false;
                }
                if (!value.short || !ETA_DISPLAY_SHORTS.has(value.short)) {
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
                const aShort = a.short || '';
                const bShort = b.short || '';
                const aOrder = ETA_DISPLAY_ORDER[aShort as EtaConstants] ?? 99;
                const bOrder = ETA_DISPLAY_ORDER[bShort as EtaConstants] ?? 99;
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
                        <span className="font-medium">{value.long || value.short}:</span>
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
            {ETA_BUTTON_KEYS.map(key => {
              const value = displayData[key] || { short: key, long: '', strValue: '', unit: '' };
              const isActive = activeKey === key;
              const textValue = isActive ? EtaText.EIN : EtaText.AUS;
              return (
                <div key={key} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {ETA_BUTTON_LABELS[key] || value.long}:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${isActive ? 'badge--ok' :
                        textValue === EtaText.AUS ? 'badge--error' :
                          'badge--neutral'
                        }`}>
                        {textValue}
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
                        aria-checked={isActive}
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
