'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError } from '@/redux/wifiAf83Slice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';
import { DEFAULT_UPDATE_TIMER } from '@/reader/functions/types-constants/TimerConstants';

// Constants

interface ApiResponse {
  data: WifiAF83Data;
  config?: ConfigState['data'];
}

const MIN_API_INTERVAL = 5000; // Minimum 5 seconds between API calls

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
  const lastTSoll = useRef(config.data.t_soll);
  const lastApiCall = useRef<number>(0);

  const calculateDiff = useCallback((indoorTemp: number, tSoll: string) => {
    const tSollNum = parseFloat(tSoll);
    if (!isNaN(tSollNum) && !isNaN(indoorTemp)) {
      return tSollNum - indoorTemp;
    }
    return 0;
  }, []);

  const loadAndStoreWifi = useCallback(async () => {
    const now = Date.now();
    if (now - lastApiCall.current < MIN_API_INTERVAL) {
      console.log('Skipping API call - too frequent');
      return;
    }

    try {
      setIsLoading(true);
      lastApiCall.current = now;
      
      const response = await fetch('/api/wifiaf83/read');
      if (!response.ok) {
        throw new Error('Failed to fetch WiFi data');
      }

      const { data } = await response.json() as ApiResponse;
      
      // Calculate diff with indoor temperature
      if (data.indoorTemperature !== undefined) {
        data.diff = calculateDiff(data.indoorTemperature, config.data.t_soll);
      }

      setWifiData(data);
      dispatch(storeData(data));
    } catch (error) {
      console.error('Error fetching WifiAf83 data:', error);
      dispatch(storeError((error as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, calculateDiff, config.data.t_soll]);

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
      // Ensure timer is not less than minimum interval
      const safeTimer = Math.max(updateTimer, MIN_API_INTERVAL);
      
      // Clear existing interval if any
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
      
      // Set new interval
      intervalId.current = setInterval(loadAndStoreWifi, safeTimer);
    }

    // Cleanup function
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };
  }, [loadAndStoreWifi, config.data.t_update_timer]);

  // Update config t_delta when T_SOLL changes
  useEffect(() => {
    if (config.data.t_soll !== lastTSoll.current && wifiData?.indoorTemperature !== undefined) {
      const newDiff = calculateDiff(wifiData.indoorTemperature, config.data.t_soll);
      
      // Update config with new diff
      dispatch(storeConfigData({
        ...config.data,
        t_delta: newDiff.toFixed(1)
      }));
      
      lastTSoll.current = config.data.t_soll;
    }
  }, [config.data.t_soll, wifiData?.indoorTemperature, calculateDiff, config.data, dispatch]);

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