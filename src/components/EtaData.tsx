'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSelector, useStore } from 'react-redux';
import { RootState } from '@/redux';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { storeData as storeControlData } from '@/redux/controlSlice';
import { ETA_MODE_BUTTONS, ETA_MODE_LABELS, EtaModeButton, EtaPos, EtaText, EtaButtons, isCircuitPosition } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { API } from '@/constants/apiPaths';
import { useToast } from '@/components/ToastProvider';
import { getEtaModeState } from '@/lib/etaModeState';
import { getManualOverrideDuration } from '@/lib/controlLogic';
import HeatingCircuitDialog from '@/components/HeatingCircuitDialog';

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
  { key: EtaButtons.HT, label: ETA_MODE_LABELS[EtaButtons.HT], longLabel: 'Heizen Taste' },
  { key: EtaButtons.KT, label: ETA_MODE_LABELS[EtaButtons.KT], longLabel: 'Kommen Taste' },
  { key: EtaButtons.AA, label: ETA_MODE_LABELS[EtaButtons.AA], longLabel: 'Autotaste' },
  { key: EtaButtons.GT, label: ETA_MODE_LABELS[EtaButtons.GT], longLabel: 'Gehen Taste' },
  { key: EtaButtons.DT, label: ETA_MODE_LABELS[EtaButtons.DT], longLabel: 'Absenken Taste' },
] as const;
const ETA_BUTTON_KEYS = ETA_BUTTON_OPTIONS.map(option => option.key);
const ETA_BUTTON_LABELS = Object.fromEntries(
  ETA_BUTTON_OPTIONS.map(option => [option.key, option.longLabel])
) as Record<EtaModeButton, string>;

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
  const store = useStore<RootState>();
  const config = useSelector((state: RootState) => state.config.data);
  const etaState = useSelector((state: RootState) => state.eta);
  const serverControlState = useSelector((state: RootState) => state.control);
  // Prevent overlapping update operations
  const updateBusyRef = useRef<boolean>(false);

  const [displayData, setDisplayData] = useState<DisplayDataType | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [overrideActive, setOverrideActive] = useState<boolean>(false);
  const [overrideRemainingMs, setOverrideRemainingMs] = useState<number>(0);
  const [circuitConfirmation, setCircuitConfirmation] = useState<{
    id: string;
    expected: EtaPos;
    target: EtaPos;
  } | null>(null);
  const { showToast } = useToast();
  const lastTempState = useRef<{
    manualOverride: boolean;
    manualOverrideTime: number | null;
  }>({
    manualOverride: false,
    manualOverrideTime: null
  });

  useEffect(() => {
    lastTempState.current = { ...serverControlState };
    if (!serverControlState.manualOverride || serverControlState.manualOverrideTime === null) {
      setOverrideActive(false);
      setOverrideRemainingMs(0);
      return;
    }
    const timeoutMs = getManualOverrideDuration(config.t_override);
    const remaining = Math.max(0, timeoutMs - (Date.now() - serverControlState.manualOverrideTime));
    setOverrideActive(remaining > 0);
    setOverrideRemainingMs(remaining);
  }, [serverControlState, config.t_override]);

  const confirmCircuitChange = useCallback(async () => {
    if (!circuitConfirmation || updateBusyRef.current) return;
    const { id, expected, target } = circuitConfirmation;
    if (store.getState().eta.data[id]?.value !== expected) {
      setCircuitConfirmation(null);
      showToast('Der Heizkreis-Zustand hat sich geändert. Bitte erneut prüfen.', 'error');
      return;
    }
    updateBusyRef.current = true;
    setIsUpdating(true);
    try {
      let response: Response;
      let result: { success?: boolean; error?: string; data?: RootState['eta']['data'][string] };
      try {
        response = await fetch(API.ETA_HEATING_CIRCUIT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, expected, target }),
        });
        result = await response.json();
      } catch {
        throw new Error('Der Schaltzustand ist ungewiss. Bitte an der ETA prüfen, bevor erneut geschaltet wird.');
      }
      if (result.data) {
        const current = store.getState().eta.data;
        dispatch(storeEtaData({ ...current, [id]: result.data }));
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Heizkreis-Schaltung fehlgeschlagen');
      }
      showToast(target === EtaPos.EIN ? 'Heizkreis eingeschaltet' : 'Heizkreis ausgeschaltet', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Heizkreis-Schaltung fehlgeschlagen', 'error');
    } finally {
      updateBusyRef.current = false;
      setIsUpdating(false);
      setCircuitConfirmation(null);
    }
  }, [circuitConfirmation, dispatch, showToast, store]);

  // Memoized map of button short codes to their URIs
  const buttonIds = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (!etaState.data) return map;
    Object.entries(etaState.data).forEach(([uri, data]) => {
      if (ETA_MODE_BUTTONS.includes(data.short as EtaModeButton)) {
        map[data.short ?? ''] = uri;
      }
    });
    return map;
  }, [etaState.data]);

  // ETA data is now loaded centrally by BackgroundSync
  // This component only reads from Redux store

  const updateButtonStates = useCallback(async (activeButton: EtaModeButton, isManual: boolean = false) => {
    if (updateBusyRef.current) throw new Error('Eine ETA-Aktualisierung läuft bereits');
    updateBusyRef.current = true;
    try {
      setIsUpdating(true);

      // No-op if already active
      const currentActive = (() => {
        for (const [, data] of Object.entries(etaState.data)) {
          if (ETA_MODE_BUTTONS.includes(data.short as EtaModeButton) && data.value === EtaPos.EIN) {
            return data.short as EtaModeButton;
          }
        }
        return null;
      })();
      if (currentActive === activeButton && !isManual) {
        return;
      }
      if (!buttonIds[activeButton]) {
        throw new Error(`Button ID not found for ${activeButton}`);
      }

      const response = await fetch(API.ETA_HEATING_MODE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetButton: activeButton,
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
      throw error;
    } finally {
      updateBusyRef.current = false;
      setIsUpdating(false);
    }
  }, [dispatch, etaState.data, buttonIds]);

  const activeKey = useMemo(() => getEtaModeState(etaState.data).activeButton, [etaState.data]);

  // (Removed duplicate temperature control effect; consolidated below)

  // Update display data when etaState changes
  useEffect(() => {
    if (!etaState.data) return;

    const newDisplayData: DisplayDataType = {};

    Object.values(etaState.data).forEach(entry => {
      if (ETA_MODE_BUTTONS.includes(entry.short as EtaModeButton)) {
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

  const handleButtonClick = useCallback(async (clickedButton: EtaModeButton) => {
    try {
      await updateButtonStates(clickedButton, true);
      if (clickedButton === EtaButtons.AA) {
        lastTempState.current.manualOverride = false;
        lastTempState.current.manualOverrideTime = null;
        setOverrideActive(false);
        setOverrideRemainingMs(0);
        dispatch(storeControlData({ manualOverride: false, manualOverrideTime: null }));
      } else {
        const overrideMs = getManualOverrideDuration(config.t_override);
        const overrideTime = Date.now();
        lastTempState.current.manualOverride = true;
        lastTempState.current.manualOverrideTime = overrideTime;
        setOverrideActive(overrideMs > 0);
        setOverrideRemainingMs(overrideMs);
        dispatch(storeControlData({ manualOverride: true, manualOverrideTime: overrideTime }));
      }
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
  }, [updateButtonStates, config.t_override, showToast, dispatch]);

  // Countdown for manual override; updates every second
  useEffect(() => {
    const interval = setInterval(() => {
      const timeoutMs = getManualOverrideDuration(config.t_override);
      if (lastTempState.current.manualOverride && lastTempState.current.manualOverrideTime !== null) {
        const elapsed = Date.now() - lastTempState.current.manualOverrideTime;
        const remaining = Math.max(0, timeoutMs - elapsed);
        setOverrideActive(remaining > 0);
        setOverrideRemainingMs(remaining);
        if (remaining === 0) {
          lastTempState.current.manualOverride = false;
          lastTempState.current.manualOverrideTime = null;
          dispatch(storeControlData({ manualOverride: false, manualOverrideTime: null }));
        }
      } else {
        setOverrideActive(false);
        setOverrideRemainingMs(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [config.t_override, dispatch]);

  const cancelOverride = useCallback(async () => {
    try {
      await updateButtonStates(EtaButtons.AA, true);
      lastTempState.current.manualOverride = false;
      lastTempState.current.manualOverrideTime = null;
      setOverrideActive(false);
      setOverrideRemainingMs(0);
      dispatch(storeControlData({ manualOverride: false, manualOverrideTime: null }));
      showToast('Override beendet · Auto aktiviert', 'success');
    } catch (e) {
      console.error('Error cancelling manual override:', e);
      showToast(e instanceof Error ? e.message : 'Override beenden fehlgeschlagen', 'error');
    }
  }, [updateButtonStates, showToast, dispatch]);

  // Periodic refresh is now handled by BackgroundSync - no need for interval here

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
    <div className="card etaControlCard">
      <div className="card__header card__header--modern">
        <span className="card__icon" aria-hidden="true">♨</span>
        <div>
          <h2 className="card__title">Heizungssteuerung</h2>
          <p className="card__subtitle">ETA-Heizmodus und aktuelle Kesselwerte</p>
        </div>
        <span className={`source-pill ${etaState.isStale ? '' : 'source-pill--live'}`}>
          {etaState.isStale ? 'Daten veraltet' : '● verbunden'}
        </span>
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

      {(etaState.data && Object.keys(etaState.data).length > 0) || displayData ? (
        <div className="space-y-3 text-sm sm:text-base">
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(etaState.data || {})
              .filter(([_, value]) => {
                if (ETA_MODE_BUTTONS.includes(value.short as EtaModeButton)) {
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
                        {value.short === EtaConstants.EIN_AUS_TASTE ? (
                          <>
                            <span className="badge badge--neutral">{text}</span>
                            <button
                              type="button"
                              className="switch etaCircuitSwitch"
                              role="switch"
                              aria-checked={value.value === EtaPos.EIN}
                              disabled={isUpdating || !isCircuitPosition(value.value)}
                              onClick={() => {
                                if (!isCircuitPosition(value.value)) return;
                                setCircuitConfirmation({
                                  id: key,
                                  expected: value.value,
                                  target: value.value === EtaPos.EIN ? EtaPos.AUS : EtaPos.EIN,
                                });
                              }}
                              aria-label={isCircuitPosition(value.value)
                                ? `Heizkreis ${value.value === EtaPos.EIN ? 'ausschalten' : 'einschalten'}`
                                : 'Heizkreis-Status unbekannt'}
                            >
                              <span className="switch__thumb" />
                            </button>
                          </>
                        ) : (
                          <span className="badge badge--neutral">
                            {text}{value.unit && <span>&nbsp;{value.unit}</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {/* If etaState.data is empty but we have displayData, show a message */}
            {(!etaState.data || Object.keys(etaState.data).length === 0) && displayData && (
              <div className="text-center text-muted py-4">
                <p>Daten werden aktualisiert…</p>
              </div>
            )}
            <details className="etaModePanel" open>
              <summary className="etaModePanel__summary" aria-label="ETA-Heizmodus ein-/ausblenden">
                <strong>ETA-Heizmodus</strong>
                <span>
                  {activeKey
                    ? `${ETA_BUTTON_OPTIONS.find(o => o.key === activeKey)?.label ?? activeKey} aktiv`
                    : 'exklusive Auswahl'}
                  <i className="etaModePanel__chev" aria-hidden="true">⌄</i>
                </span>
              </summary>
            <div className="etaModeGrid" role="radiogroup" aria-label="ETA-Heizmodus">
            {ETA_BUTTON_KEYS.map(key => {
              const value = displayData[key] || { short: key, long: '', strValue: '', unit: '' };
              const isActive = activeKey === key;
              return (
                <div key={key} className={`etaModeItem ${isActive ? 'etaModeItem--active' : ''}`}>
                      <span className="etaModeItem__label">
                        {ETA_BUTTON_LABELS[key] || value.long}:
                      </span>
                      <button
                        onClick={() => {
                          if (!isUpdating && isHeatingKey(key)) {
                            handleButtonClick(key);
                          }
                        }}
                        disabled={isUpdating}
                        className={`switch ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        role="radio"
                        aria-checked={isActive}
                        aria-busy={isUpdating}
                        title={`Toggle ${value.long}`}
                      >
                        <span className="sr-only">Toggle {value.long}</span>
                        <span className="switch__thumb" />
                      </button>
                </div>
              );
            })}
            </div>
            </details>
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center min-h-[200px]">
          <p>Laden…</p>
        </div>
      )}
      {circuitConfirmation && (
        <HeatingCircuitDialog target={circuitConfirmation.target} stale={etaState.isStale}
          busy={isUpdating} onCancel={() => setCircuitConfirmation(null)} onConfirm={confirmCircuitChange} />
      )}
    </div>
  );
};

type HeatingKey = EtaModeButton;

const isHeatingKey = (key: string): key is HeatingKey => {
  return ETA_MODE_BUTTONS.includes(key as EtaModeButton);
};

export default EtaData;
