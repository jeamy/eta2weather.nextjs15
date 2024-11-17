'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError } from '@/redux/wifiAf83Slice';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';
import { DEFAULT_UPDATE_TIMER } from '@/reader/functions/types-constants/TimerConstants';

// Constants

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
  const [wifiData, setWifiData] = useState<WifiAF83Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  const loadAndStoreWifi = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/wifiaf83/read');
      if (!response.ok) {
        throw new Error('Failed to fetch WiFi data');
      }

      const { data } = await response.json() as ApiResponse;
      setWifiData(data);
      dispatch(storeData(data));
    } catch (error) {
      console.error('Error fetching WiFi data:', error);
      dispatch(storeError((error as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  // Initial load effect
  useEffect(() => {
    if (isFirstLoad.current) {
      loadAndStoreWifi();
      isFirstLoad.current = false;
    }
  }, [loadAndStoreWifi]);

  // Timer effect
  useEffect(() => {
    const updateTimer = parseInt(config.data.t_update_timer) || DEFAULT_UPDATE_TIMER;
    
    if (updateTimer > 0) {
      // Clear existing interval if any
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
      
      // Set new interval
      intervalId.current = setInterval(loadAndStoreWifi, updateTimer);
    }

    // Cleanup function
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };
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
                <span className="ml-1 text-gray-600">°C</span>
              </div>
            </div>
          )}
        </div>
        {wifiData.diff !== undefined && (
          <div className="w-[400px] pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center px-4 py-2">
              <span>Diff:</span>
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