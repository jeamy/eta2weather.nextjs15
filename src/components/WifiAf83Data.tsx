'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { calculateMinTempDiff } from '@/utils/Functions';
import { ConfigKeys, TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';
import Image from 'next/image';

const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('de-DE', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Vienna'
  });
};

const WifiAf83Data: React.FC = () => {
  const config = useSelector((state: RootState) => state.config);
  const wifiData = useSelector((state: RootState) => state.wifiAf83.data);
  const isLoading = useSelector((state: RootState) => state.wifiAf83.loadingState.isLoading);

  if (isLoading || wifiData.time <= 0) {
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
            src="/weather-logo.jpg"
            alt="Weather"
            width={150}
            height={150}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold">WiFi Data</h2>
      </div>
      <div className="space-y-3 text-sm sm:text-base">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="font-medium">Außentemperatur:</span>
              <span className={`badge ${wifiData.temperature > 0 ? 'badge--ok' : wifiData.temperature < 0 ? 'badge--warn' : 'badge--neutral'}`}>
                {wifiData.temperature}°C
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Innentemperatur:</span>
              {(() => {
                const min = Number(config.data[ConfigKeys.T_MIN]);
                const ind = Number(wifiData.indoorTemperature);
                const hasMin = Number.isFinite(min);
                const cls = hasMin ? (ind >= min ? 'badge--ok' : 'badge--warn') : 'badge--neutral';
                return <span className={`badge ${cls}`}>{ind}°C</span>;
              })()}
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Diff Indoor/Soll:</span>
              {(() => {
                // Calculate live diff: (t_soll + t_delta) - indoor_temperature
                const tSoll = Number(config.data[ConfigKeys.T_SOLL] ?? NaN);
                const tDelta = Number(config.data[ConfigKeys.T_DELTA] ?? NaN);
                const indoor = Number(wifiData.indoorTemperature ?? NaN);

                if (!Number.isFinite(tSoll) || !Number.isFinite(tDelta) || !Number.isFinite(indoor)) {
                  return <span className="badge badge--warn">--</span>;
                }

                const diff = (tSoll + tDelta / TEMP_CALC_CONSTANTS.DELTA_DAMPENING_FACTOR) - indoor;
                const roundedDiff = Math.round(diff * 100) / 100;
                // Positive diff => kälter als Soll (blau), Negative => wärmer als Soll (grün)
                const cls = roundedDiff > 0 ? 'badge--primary' : roundedDiff < 0 ? 'badge--ok' : 'badge--neutral';
                return <span className={`badge ${cls}`}>{roundedDiff.toFixed(2)}°C</span>;
              })()}
            </div>
            {config.data[ConfigKeys.T_MIN] && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Diff Min/Indoor:</span>
                {(() => {
                  const d = calculateMinTempDiff(wifiData.indoorTemperature, config.data[ConfigKeys.T_MIN]);
                  const cls = d > 0 ? 'badge--ok' : d < 0 ? 'badge--warn' : 'badge--neutral';
                  return <span className={`badge ${cls}`}>{d}°C</span>;
                })()}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="font-medium">Last Update:</span>
            <span className="badge badge--neutral">{formatDateTime(wifiData.time)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WifiAf83Data;
