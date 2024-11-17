'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import { calculateTemperatureDiff } from '@/utils/Functions';

interface ApiResponse {
  data: WifiAF83Data;
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
  });
};

const WifiAf83Data: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config);
  const etaState = useSelector((state: RootState) => state.eta);
  const [wifiData, setWifiData] = useState<WifiAF83Data | null>(null);
  const [isLoading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const lastApiCall = useRef<number>(0);
  const lastTSoll = useRef(config.data.t_soll);
  const lastTDelta = useRef(config.data.t_delta);

  // Calculate diff only on initial data load and visibility change
  useEffect(() => {
    const calculateAndUpdateDiff = () => {
      if (!wifiData || !etaState.data || isLoading) {
        return;
      }

      // Only calculate on initial data load
      if (!isFirstLoad.current) {
        return;
      }
      isFirstLoad.current = false;

      const tempDiff = calculateTemperatureDiff(config, {
        data: wifiData,
        loadingState: {
          isLoading: false,
          error: null
        }
      });

      if (tempDiff.diff !== null) {
        const numericDiff = tempDiff.diff;
        setWifiData((prev): WifiAF83Data => {
          if (!prev) {
            return {
              ...wifiData!,
              diff: numericDiff
            } as WifiAF83Data;
          }
          return {
            ...prev,
            diff: numericDiff
          };
        });
      }
    };

    calculateAndUpdateDiff();

    // Calculate on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, recalculating diff');
        // Reset isFirstLoad to allow calculation on visibility change
        isFirstLoad.current = true;
        calculateAndUpdateDiff();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wifiData, etaState.data, config, isLoading]);

  // Update diff when t_soll or t_delta changes
  useEffect(() => {
    if (!wifiData || !etaState.data || isLoading) {
      return;
    }

    const tSollChanged = config.data.t_soll !== lastTSoll.current;
    const tDeltaChanged = config.data.t_delta !== lastTDelta.current;

    if (tSollChanged || tDeltaChanged) {
      console.log('t_soll or t_delta changed, calculating new diff');
      const tempDiff = calculateTemperatureDiff(config, {
        data: wifiData,
        loadingState: {
          isLoading: false,
          error: null
        }
      });

      if (tempDiff.diff !== null) {
        const numericDiff = tempDiff.diff;
        setWifiData((prev): WifiAF83Data => {
          if (!prev) {
            return {
              ...wifiData!,
              diff: numericDiff
            } as WifiAF83Data;
          }
          return {
            ...prev,
            diff: numericDiff
          };
        });
      }
      lastTSoll.current = config.data.t_soll;
      lastTDelta.current = config.data.t_delta;
    }
  }, [config.data.t_soll, config.data.t_delta, wifiData, etaState.data, config, isLoading]);

  const loadAndStoreWifi = useCallback(async () => {
    const now = Date.now();
    if (now - lastApiCall.current < MIN_API_INTERVAL) {
      return;
    }

    try {
      setLoading(true);
      dispatch({ type: 'wifiAf83/setLoading', payload: true });
      lastApiCall.current = now;
      
      const response = await fetch('/api/wifiaf83/read');
      if (!response.ok) {
        throw new Error('Failed to fetch WiFi data');
      }

      const { data } = await response.json() as ApiResponse;
      
      if (!data || typeof data.temperature === 'undefined' || typeof data.indoorTemperature === 'undefined') {
        throw new Error('Invalid temperature data structure');
      }

      const transformedData: WifiAF83Data = {
        time: Number(data.time),
        datestring: data.datestring,
        temperature: Number(data.temperature),
        indoorTemperature: Number(data.indoorTemperature),
        diff: Number(data.diff || 0)
      };

      setWifiData(transformedData);
      dispatch({ type: 'wifiAf83/storeData', payload: transformedData });

    } catch (error) {
      console.error('Error fetching WifiAf83 data:', error);
      dispatch({ type: 'wifiAf83/storeError', payload: (error as Error).message });
    } finally {
      setLoading(false);
      dispatch({ type: 'wifiAf83/setLoading', payload: false });
    }
  }, [dispatch]);

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

  if (isLoading || !wifiData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col items-start">
      <h1 className="text-2xl py-5">WiFi AF83 Daten:</h1>
      <div className="space-y-2">
        <div className="w-[400px]">
          <h3 className="font-semibold">Messwerte</h3>
          {wifiData.temperature !== undefined && (
            <div className="flex justify-between items-center px-4 py-2">
              <span>Außentemperatur:</span>
              <div className="text-right">
                <span className="font-mono font-semibold">{wifiData.temperature.toFixed(1)}</span>
                <span className="ml-1 text-gray-600">°C</span>
              </div>
            </div>
          )}
          {wifiData.indoorTemperature !== undefined && (
            <div className="flex justify-between items-center px-4 py-2">
              <span>Innentemperatur:</span>
              <div className="text-right">
                <span className="font-mono font-semibold">{wifiData.indoorTemperature.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
        {wifiData.diff !== undefined && (
          <div className="w-[400px] pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center px-4 py-2">
              <span>Diff Soll/Innentemperatur:</span>
              <div className="text-right">
                <span className="font-mono font-semibold">{wifiData.diff.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}
        <div className="w-[400px] pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center px-4 py-2">
            <span>Datum:</span>
            <div className="text-right">
              <span className="font-mono">{formatDateTime(wifiData.time)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WifiAf83Data;