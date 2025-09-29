"use client";

import React, { useMemo, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/redux";
import { storeData } from "@/redux/configSlice";
import { ConfigKeys } from "@/reader/functions/types-constants/ConfigConstants";
import { EtaButtons, EtaPos } from "@/reader/functions/types-constants/EtaConstants";
import { EtaConstants as EtaConstKeys, defaultNames2Id } from "@/reader/functions/types-constants/Names2IDconstants";
import { API } from "@/constants/apiPaths";

function formatTime(ts: number): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "-";
  }
}

function parseNum(raw: any): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(',', '.');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export default function HomeHero() {
  const dispatch = useDispatch();
  const wifi = useSelector((s: RootState) => s.wifiAf83.data);
  const config = useSelector((s: RootState) => s.config.data);
  const eta = useSelector((s: RootState) => s.eta.data);
  const lastDiffUpdateRef = useRef<number>(0);

  const sliderPercent = useMemo(() => {
    const v = Number(config?.[ConfigKeys.T_SLIDER] ?? 0);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
  }, [config]);

  const diffIndoorSoll = useMemo(() => {
    // Calculate live diff: (t_soll + t_delta) - indoor_temperature
    const tSoll = Number(config?.[ConfigKeys.T_SOLL] ?? NaN);
    const tDelta = Number(config?.[ConfigKeys.T_DELTA] ?? NaN);
    const indoor = Number(wifi?.indoorTemperature ?? NaN);
    
    if (!Number.isFinite(tSoll) || !Number.isFinite(tDelta) || !Number.isFinite(indoor)) {
      return null;
    }
    
    const diff = (tSoll + tDelta) - indoor;
    return Math.round(diff * 10) / 10; // Round to 0.1°C
  }, [config, wifi]);

  const indoorOk = useMemo(() => {
    const min = Number((config as any)?.[ConfigKeys.T_MIN]);
    const ind = Number(wifi?.indoorTemperature);
    if (!Number.isFinite(min) || !Number.isFinite(ind)) return null;
    return ind >= min;
  }, [config, wifi]);

  const mode = useMemo(() => {
    // Determine if AA (Auto) is active or one of manual keys (HT, KT, DT, GT)
    let active: string | null = null;
    for (const [uri, item] of Object.entries(eta || {})) {
      if (!item?.short) continue;
      const isButton = Object.values(EtaButtons).includes(item.short as EtaButtons);
      if (isButton && item.value === EtaPos.EIN) {
        active = item.short as string;
        break;
      }
    }
    if (active === EtaButtons.AA) return "Auto";
    if (active) return "Manuell";
    return "-";
  }, [eta]);

  const etaOutdoor = useMemo(() => {
    try {
      const id = defaultNames2Id[EtaConstKeys.AUSSENTEMP]?.id;
      const node = id ? (eta as any)?.[id] : undefined;
      let n = parseNum(node?.strValue) ?? parseNum(node?.value);
      if (n == null) {
        // Fallback: scan entries for short === 'AT'
        for (const [, item] of Object.entries((eta as any) || {})) {
          if ((item as any)?.short === EtaConstKeys.AUSSENTEMP) {
            n = parseNum((item as any)?.strValue) ?? parseNum((item as any)?.value);
            if (n != null) break;
          }
        }
      }
      return n;
    } catch {
      return null;
    }
  }, [eta]);

  const wifiOutdoor = useMemo(() => {
    const n = Number(wifi?.temperature);
    return Number.isFinite(n) ? n : null;
  }, [wifi]);

  const outdoorDiffSigned = useMemo(() => {
    if (etaOutdoor == null || wifiOutdoor == null) return null;
    const diff = wifiOutdoor - etaOutdoor; // + => WiFi wärmer als ETA, - => WiFi kälter
    return Math.round(diff * 10) / 10; // Round to 0.1°C to avoid floating point precision issues
  }, [etaOutdoor, wifiOutdoor]);

  const deltaOverrideEnabled = useMemo(() => {
    const enabled = config?.[ConfigKeys.DELTA_OVERRIDE] === 'true';
    console.log('Delta override status:', { 
      enabled, 
      rawValue: config?.[ConfigKeys.DELTA_OVERRIDE],
      configKeys: ConfigKeys.DELTA_OVERRIDE 
    });
    return enabled;
  }, [config]);

  // Auto-update delta temperature based on outdoor diff
  useEffect(() => {
    console.log('Delta auto-update useEffect triggered:', {
      deltaOverrideEnabled,
      outdoorDiffSigned,
      etaOutdoor,
      wifiOutdoor,
      currentDelta: config?.[ConfigKeys.T_DELTA]
    });
    
    // CRITICAL: Only update if BOTH ETA and WiFi outdoor values are available
    if (deltaOverrideEnabled || outdoorDiffSigned == null || etaOutdoor == null || wifiOutdoor == null) {
      console.log('Delta auto-update skipped:', { 
        deltaOverrideEnabled, 
        outdoorDiffSigned, 
        etaOutdoor, 
        wifiOutdoor,
        reason: deltaOverrideEnabled ? 'override enabled' : 
                outdoorDiffSigned == null ? 'no diff calculated' :
                etaOutdoor == null ? 'ETA outdoor missing' :
                wifiOutdoor == null ? 'WiFi outdoor missing' : 'unknown'
      });
      return;
    }
    
    const now = Date.now();
    const timeSinceLastUpdate = now - lastDiffUpdateRef.current;
    
    // Throttle updates to every 30 seconds
    if (timeSinceLastUpdate < 30000) {
      console.log('Delta auto-update throttled:', { timeSinceLastUpdate, threshold: 30000 });
      return;
    }
    
    const currentDelta = Number(config?.[ConfigKeys.T_DELTA] ?? 0);
    const newDelta = Math.round(outdoorDiffSigned * 10) / 10; // Round to 0.1°C
    const deltaChange = Math.round(Math.abs(newDelta - currentDelta) * 10) / 10; // Round to avoid floating point precision issues
    
    // Additional safety check: ensure values are realistic (between -50°C and +50°C)
    if (Math.abs(etaOutdoor) > 50 || Math.abs(wifiOutdoor) > 50) {
      console.log('Delta auto-update skipped - unrealistic temperature values:', { etaOutdoor, wifiOutdoor });
      return;
    }
    
    // Additional safety check3: ensure delta change is not too extreme (max ±5°C)
    if (Math.abs(newDelta) > 3) {
      console.log('Delta auto-update skipped - extreme delta value:', { newDelta, etaOutdoor, wifiOutdoor });
      return;
    }
    
    console.log('Delta auto-update check:', {
      currentDelta,
      newDelta,
      deltaChange,
      threshold: 0.1,
      outdoorDiffSigned,
      etaOutdoor,
      wifiOutdoor
    });
    
    // Only update if difference is significant (>= 0.1°C) - reduced threshold
    if (deltaChange >= 0.1) {
      console.log('Updating delta temperature:', { from: currentDelta, to: newDelta });
      lastDiffUpdateRef.current = now;
      
      // Update config via API
      fetch(API.CONFIG, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: ConfigKeys.T_DELTA,
          value: newDelta.toString()
        }),
      })
      .then(response => response.json())
      .then(result => {
        if (result.success && result.config) {
          console.log('Delta temperature updated successfully:', result.config[ConfigKeys.T_DELTA]);
          dispatch(storeData(result.config));
        } else {
          console.error('Failed to update delta temperature:', result);
        }
      })
      .catch(error => {
        console.error('Error updating delta temperature:', error);
      });
    } else {
      console.log('Delta change too small, skipping update');
    }
  }, [outdoorDiffSigned, deltaOverrideEnabled, config, dispatch, etaOutdoor, wifiOutdoor]);

  return (
    <div className="card" aria-label="Übersicht">
      <div className="card__header">
        <h2 className="card__title">Übersicht</h2>
        <span className="text-xs text-gray-500">Letztes Update: {formatTime(wifi?.time)}</span>
      </div>

      <div className="home-hero__row">
        <div className="statGrid">
          <div className="stat" title="Innentemperatur">
            <div className="stat__label">Indoor</div>
            <div className="stat__value">
              {(() => {
                const v = Number(wifi?.indoorTemperature ?? 0).toFixed(1) + '°C';
                if (indoorOk === null) return v;
                const cls = indoorOk ? 'badge--ok' : 'badge--warn';
                return <span className={`badge ${cls}`}>{v}</span>;
              })()}
            </div>
            <div className="stat__trend">Wohnbereich</div>
          </div>
          <div className="stat" title="Außentemperatur">
            <div className="stat__label">Outdoor</div>
            <div className="stat__value">{Number(wifi?.temperature ?? 0).toFixed(1)}°C</div>
            <div className="stat__trend">Außen</div>
          </div>
          <div className="stat" title="Differenz Indoor/Soll">
            <div className="stat__label">Diff Indoor/Soll</div>
            <div className="stat__value">
              {diffIndoorSoll !== null ? (
                <span className={`badge ${diffIndoorSoll > 0 ? 'badge--ok' : diffIndoorSoll < 0 ? 'badge--primary' : 'badge--neutral'}`}>
                  {diffIndoorSoll.toFixed(1)}°C
                </span>
              ) : "-"}
            </div>
            <div className="stat__trend">positiv = kälter als Soll · negativ = wärmer als Soll</div>
          </div>
          <div className="stat" title="Schieber Position">
            <div className="stat__label">Schieber</div>
            <div className="stat__value">{sliderPercent}%</div>
            <div className="progress mt-1" aria-label="Empfohlene Schieber Position">
              <div className="progress__bar" style={{ width: `${sliderPercent}%` }} />
            </div>
          </div>
        </div>
        <div className="home-hero__right">
          <div className="stat" title="Diff ETA/WiFi Außentemperatur">
            <div className="stat__label">Diff ETA/WiFi Outdoor</div>
            <div className="stat__value">
              {outdoorDiffSigned !== null ? (
                <span title={`ETA: ${etaOutdoor?.toFixed(1)}° · WIFI: ${wifiOutdoor?.toFixed(1)}°`}>
                  ETA: {etaOutdoor?.toFixed(1)}° WIFI: {wifiOutdoor?.toFixed(1)}°
                  {' '}
                  <span className={`badge ${outdoorDiffSigned > 0 ? 'badge--ok' : outdoorDiffSigned < 0 ? 'badge--primary' : 'badge--neutral'}`}>
                    {outdoorDiffSigned > 0 ? '+' : ''}{outdoorDiffSigned.toFixed(1)}°
                  </span>
                </span>
              ) : etaOutdoor !== null ? (
                <span title="WiFi data temporarily unavailable">
                  ETA: {etaOutdoor.toFixed(1)}° WIFI: -- 
                  <span className="badge badge--warn">Warte auf WiFi</span>
                </span>
              ) : wifiOutdoor !== null ? (
                <span title="ETA data temporarily unavailable">
                  ETA: -- WIFI: {wifiOutdoor.toFixed(1)}°
                  <span className="badge badge--warn">Warte auf ETA</span>
                </span>
              ) : (
                <span className="badge badge--warn">Warte auf Daten</span>
              )}
            </div>
            <div className="stat__trend">
              ETA vs WiFi Außentemperatur · {deltaOverrideEnabled ? (
                <span className="text-orange-500">Delta manuell</span>
              ) : (
                <span className="text-green-600">Delta automatisch</span>
              )}
            </div>
          </div>
          <div className="stat" title="Betriebsmodus">
            <div className="stat__label">Modus</div>
            <div className="stat__value">{mode}</div>
            <div className="stat__trend">AA = Auto, sonst manuell</div>
          </div>
        </div>
      </div>
    </div>
  );
}
