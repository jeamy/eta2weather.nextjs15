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
    <section className="homeHero" aria-label="Anlagenübersicht">
      <div className="homeHero__heading">
        <div>
          <p className="homeHero__eyebrow">Anlagenübersicht</p>
          <h1>Heizung und Raumklima auf einen Blick</h1>
        </div>
        <span className="homeHero__updated">Letztes Update: {formatTime(wifi?.time)}</span>
      </div>
      <div className="homeHero__grid">
        <article className="homeKpi" title="Innentemperatur">
          <div className="homeKpi__head"><span>Innen</span><i>⌂</i></div>
          <div className={`homeKpi__value ${indoorOk === true ? 'is-good' : indoorOk === false ? 'is-warning' : ''}`}>{Number(wifi?.indoorTemperature ?? 0).toFixed(1)} °C</div>
          <div className="homeKpi__meta">Wohnbereich</div>
        </article>
        <article className="homeKpi" title="Außentemperatur WiFi">
          <div className="homeKpi__head"><span>Außen · WiFi</span><i>☁</i></div>
          <div className="homeKpi__value">{Number(wifi?.temperature ?? 0).toFixed(1)} °C</div>
          <div className="homeKpi__meta">Sensor aktuell</div>
        </article>
        <article className="homeKpi" title="Differenz Indoor/Soll">
          <div className="homeKpi__head"><span>Indoor / Soll</span><i>△</i></div>
          <div className={`homeKpi__value ${diffIndoorSoll !== null && diffIndoorSoll < 0 ? 'is-good' : 'is-info'}`}>{diffIndoorSoll !== null ? `${diffIndoorSoll > 0 ? '+' : ''}${diffIndoorSoll.toFixed(2)} °C` : '–'}</div>
          <div className="homeKpi__meta">positiv = kälter als Soll</div>
        </article>
        <article className="homeKpi" title="Empfohlene Schieberposition">
          <div className="homeKpi__head"><span>Schieber</span><i>↔</i></div>
          <div className="homeKpi__value">{sliderPercent > 0 ? '+' : ''}{sliderPercent} %</div>
          <div className="progress" aria-label="Empfohlene Schieberposition"><div className="progress__bar progress__bar--ok" style={{ width: `${Math.max(0, Math.min(100, (sliderPercent + 100) / 2))}%` }} /></div>
        </article>
        <article className="homeKpi" title="Betriebsmodus">
          <div className="homeKpi__head"><span>Betriebsmodus</span><i>A</i></div>
          <div className={`homeKpi__value ${mode === 'Auto' ? 'is-good' : 'is-warning'}`}>{mode}</div>
          <div className="homeKpi__meta">{schaltzustand ?? 'ETA-Tastenstatus'}</div>
        </article>
        <article className="homeKpi" title="Differenz ETA/WiFi Außentemperatur">
          <div className="homeKpi__head"><span>ETA / WiFi außen</span><i>≋</i></div>
          <div className="homeKpi__value">{outdoorDiffSigned !== null ? `${outdoorDiffSigned > 0 ? '+' : ''}${outdoorDiffSigned.toFixed(1)} °` : '–'}</div>
          <div className="homeKpi__meta">
            {etaOutdoor !== null && wifiOutdoor !== null ? `${etaOutdoor.toFixed(1)} ° / ${wifiOutdoor.toFixed(1)} °` : 'Warte auf Daten'} · Delta {deltaOverrideEnabled ? 'manuell' : 'auto'}
          </div>
        </article>
      </div>
    </section>
  );
}
