"use client";

import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux";
import { ConfigKeys } from "@/reader/functions/types-constants/ConfigConstants";
import { EtaButtons, EtaPos } from "@/reader/functions/types-constants/EtaConstants";
import { EtaConstants as EtaConstKeys, defaultNames2Id } from "@/reader/functions/types-constants/Names2IDconstants";

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
  const wifi = useSelector((s: RootState) => s.wifiAf83.data);
  const config = useSelector((s: RootState) => s.config.data);
  const eta = useSelector((s: RootState) => s.eta.data);

  const sliderPercent = useMemo(() => {
    const v = Number(config?.[ConfigKeys.T_SLIDER] ?? 0);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
  }, [config]);

  const diffIndoorSoll = useMemo(() => {
    const d = Number(config?.[ConfigKeys.DIFF] ?? NaN);
    if (!Number.isFinite(d)) return null;
    return d;
  }, [config]);

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
    return etaOutdoor - wifiOutdoor; // - => WiFi wärmer als ETA, + => WiFi kälter
  }, [etaOutdoor, wifiOutdoor]);

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
            <div className="stat__trend">ETA vs WiFi Außentemperatur</div>
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
