"use client";

import { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux";
import { ConfigKeys, TEMP_CALC_CONSTANTS } from "@/reader/functions/types-constants/ConfigConstants";
import { ETA_MODE_BUTTONS, EtaModeButton, EtaButtons, EtaPos } from "@/reader/functions/types-constants/EtaConstants";
import { EtaConstants as EtaConstKeys, defaultNames2Id } from "@/reader/functions/types-constants/Names2IDconstants";
import { parseNum } from "@/utils/numberParser";

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

export default function HomeHero() {
  const wifi = useSelector((s: RootState) => s.wifiAf83.data);
  const config = useSelector((s: RootState) => s.config.data);
  const eta = useSelector((s: RootState) => s.eta.data);

  const sliderPercent = useMemo(() => {
    const v = Number(config?.[ConfigKeys.T_SLIDER] ?? 0);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v);
  }, [config]);

  const diffIndoorSoll = useMemo(() => {
    // Calculate live diff: (t_soll + t_delta) - indoor_temperature
    const tSoll = Number(config?.[ConfigKeys.T_SOLL] ?? NaN);
    const tDelta = Number(config?.[ConfigKeys.T_DELTA] ?? NaN);
    const indoor = Number(wifi?.indoorTemperature ?? NaN);
    
    if (!Number.isFinite(tSoll) || !Number.isFinite(tDelta) || !Number.isFinite(indoor)) {
      return null;
    }
    
    const diff = (tSoll + tDelta / TEMP_CALC_CONSTANTS.DELTA_DAMPENING_FACTOR) - indoor;
    return Math.round(diff * 100) / 100; // Round to 0.01°C
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
    for (const item of Object.values(eta || {})) {
      if (!item?.short) continue;
      const isButton = ETA_MODE_BUTTONS.includes(item.short as EtaModeButton);
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
    const diff = etaOutdoor - wifiOutdoor; // - => WiFi wärmer als ETA, + => WiFi kälter
    return Math.round(diff * 10) / 10; // Round to 0.1°C to avoid floating point precision issues
  }, [etaOutdoor, wifiOutdoor]);

  const deltaOverrideEnabled = config?.[ConfigKeys.DELTA_OVERRIDE] === 'true';

  const schaltzustand = useMemo(() => {
    try {
      // Find SZ (Schaltzustand) entry
      for (const [, item] of Object.entries((eta as any) || {})) {
        if ((item as any)?.short === 'SZ') {
          const strVal = (item as any)?.strValue;
          const numVal = (item as any)?.value;
          return strVal && strVal.trim() !== '' ? strVal : (numVal !== undefined && numVal !== null ? String(numVal) : null);
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [eta]);

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
                <span className={`badge ${diffIndoorSoll > 0 ? 'badge--primary' : diffIndoorSoll < 0 ? 'badge--ok' : 'badge--neutral'}`}>
                  {diffIndoorSoll.toFixed(2)}°C
                </span>
              ) : "-"}
            </div>
            <div className="stat__trend">positiv = kälter als Soll · negativ = wärmer als Soll</div>
          </div>
          <div className="stat" title="Schieber Position">
            <div className="stat__label">Schaltzustand</div>
            <div className="stat__value">{schaltzustand !== null ? schaltzustand : "-"}</div>
            <div className="stat__label">Schieber</div>
            <div className="stat__value">
              <span className={`badge ${sliderPercent > 0 ? 'badge--ok' : sliderPercent < 0 ? 'badge--primary' : 'badge--neutral'}`}>
                {sliderPercent}%
              </span>
            </div>
            <div className="progress mt-1" aria-label="Empfohlene Schieber Position">
              <div 
                className={`progress__bar ${sliderPercent > 0 ? 'progress__bar--ok' : sliderPercent < 0 ? 'progress__bar--primary' : ''}`}
                style={{ width: `${Math.max(0, Math.min(100, (sliderPercent + 100) / 2))}%` }} 
              />
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
