'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import { calculateTemperatureDiff, calculateNewSliderPosition, calculateMinTempDiff } from '@/utils/Functions';
import { storeData } from '@/redux/configSlice';
import { ConfigKeys, TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';
import { EtaConstants, defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import Image from 'next/image';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';
import { API } from '@/constants/apiPaths';
import { useToast } from '@/components/ToastProvider';
import { parseNum } from '@/utils/numberParser';

interface ApiResponse {
  data: WifiAF83Data & {
    diff?: string;
  };
  config?: ConfigState['data'];
}

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
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config);
  const etaState = useSelector((state: RootState) => state.eta);
  const { showToast } = useToast();
  const [wifiData, setWifiData] = useState<WifiAF83Data | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFirstLoad = useRef(true);
  const lastApiCall = useRef<number>(0);
  const lastTSoll = useRef(config.data.t_soll);
  const lastTDelta = useRef(config.data.t_delta);

  const saveConfigValue = useCallback(async (key: ConfigKeys, value: string | number) => {
    try {
      const response = await fetch(API.CONFIG, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          value: value.toString()
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save config value for ${key}: ${errorText}`);
      }

      const result = await response.json();
      //      console.log('Saved config value:', result);
      showToast(`Konfiguration gespeichert: ${key}`, 'success');
    } catch (error) {
      console.error('Error saving config value:', error);
      showToast(error instanceof Error ? error.message : 'Konfiguration speichern fehlgeschlagen', 'error');
      throw error; // Re-throw to let the caller handle the error
    }
  }, []);

  const loadAndStoreWifi = useCallback(async () => {
    const now = Date.now();
    if (now - lastApiCall.current < MIN_API_INTERVAL) {
      return;
    }

    try {
      setIsLoading(true);
      lastApiCall.current = now;

      const response = await fetch(API.WIFI_AF83_READ);
      if (!response.ok) {
        throw new Error('Failed to fetch WifiAF83 data');
      }

      const { data } = await response.json() as ApiResponse;

      const transformedData: WifiAF83Data = {
        time: Number(data.time),
        datestring: data.datestring,
        temperature: Number(data.temperature),
        indoorTemperature: Number(data.indoorTemperature),
        allData: null
      };

      setWifiData(transformedData);
      dispatch({ type: 'wifiAf83/storeData', payload: transformedData });
    } catch (error) {
      console.error('Error fetching WifiAF83 data:', error);
      dispatch({ type: 'wifiAf83/storeError', payload: (error as Error).message });
      showToast('WiFi Daten laden fehlgeschlagen', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, setIsLoading]);

  const updateTemperatureDiff = useCallback(async () => {
    // BackgroundService ist die Quelle der Wahrheit.
    // Client berechnet nichts und persistiert nicht mehr.
    // Anzeige verwendet nur die vom Server gelieferten Config-Werte.
    return;
  }, []);

  // Monitor t_soll and t_delta changes
  useEffect(() => {
    const tSollChanged = config.data.t_soll !== lastTSoll.current;
    const tDeltaChanged = config.data.t_delta !== lastTDelta.current;

    if (tSollChanged || tDeltaChanged) {
      // Update refs
      lastTSoll.current = config.data.t_soll;
      lastTDelta.current = config.data.t_delta;

      // Save to config file
      if (tSollChanged) {
        saveConfigValue(ConfigKeys.T_SOLL, config.data.t_soll);
      }
      if (tDeltaChanged) {
        saveConfigValue(ConfigKeys.T_DELTA, config.data.t_delta);
      }

      // Trigger recalculation of temperature difference and slider position
      loadAndStoreWifi();
    }
  }, [config.data.t_soll, config.data.t_delta, saveConfigValue, loadAndStoreWifi]);

  // Initial load and timer setup
  useEffect(() => {
    if (isFirstLoad.current) {
      loadAndStoreWifi();
      isFirstLoad.current = false;
    }

    const updateTimer = Math.max(
      parseInt(config.data.t_update_timer) || DEFAULT_UPDATE_TIMER,
      MIN_API_INTERVAL
    );

    const interval = setInterval(loadAndStoreWifi, updateTimer);
    return () => clearInterval(interval);
  }, [loadAndStoreWifi, config.data.t_update_timer]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, recalculating diff');
        loadAndStoreWifi();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadAndStoreWifi]);

  // Client-side Diff/Slider-Update deaktiviert (Server steuert Sync)
  // ETA data is now loaded centrally by EtaDataProvider - no need to fetch here

  if (isLoading || !wifiData) {
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