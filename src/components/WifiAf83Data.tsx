'use client';

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError } from '@/redux/wifiAf83Slice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';

interface WifiAf83Response {
  temperature?: number;
  humidity?: number;
  pressure?: number;
  diff?: number;
  time: number;
  datestring: string;
}

interface ApiResponse {
  data: WifiAf83Response;
  config?: ConfigState['data'];
}

const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('de-DE', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const WifiAf83Data: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config);
  const [wifiData, setWifiData] = useState<WifiAf83Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAndStoreWifi = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/wifiaf83/read');
        if (!response.ok) {
          throw new Error('Failed to fetch WiFi data');
        }

        const { data, config: updatedConfig } = await response.json() as ApiResponse;
        
        // Add time and datestring to match WifiAF83Data type
        const enrichedData: WifiAf83Response = {
          ...data,
          time: Date.now(),
          datestring: formatDateTime(Date.now())
        };

        setWifiData(enrichedData);
        dispatch(storeData(enrichedData));

        // Update config in Redux if provided
        if (updatedConfig) {
          dispatch(storeConfigData(updatedConfig));
        }
      } catch (error) {
        console.error('Error fetching WiFi data:', error);
        dispatch(storeError((error as Error).message));
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load
    loadAndStoreWifi();

    // Set up interval for periodic updates
    const interval = setInterval(loadAndStoreWifi, parseInt(config.data.t_update_timer) || 60000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [dispatch, config.data.t_update_timer]);

  if (isLoading || !wifiData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col items-start">
      <h1 className="text-2xl py-5">WiFi AF83 Daten:</h1>
      <div className="space-y-2">
        <div>
          <h3 className="font-semibold">Messwerte</h3>
          {wifiData.temperature !== undefined && (
            <p>Temperatur: {wifiData.temperature.toFixed(1)} °C</p>
          )}
          {wifiData.humidity !== undefined && (
            <p>Luftfeuchtigkeit: {wifiData.humidity.toFixed(1)} %</p>
          )}
          {wifiData.pressure !== undefined && (
            <p>Luftdruck: {wifiData.pressure.toFixed(1)} hPa</p>
          )}
        </div>
        {wifiData.diff !== undefined && (
          <div className="pt-2 border-t border-gray-200">
            <p>Diff: {wifiData.diff.toFixed(1)}</p>
          </div>
        )}
        <div className="pt-2 border-t border-gray-200">
          <p>Datum: {wifiData.datestring}</p>
        </div>
      </div>
    </div>
  );
};

export default WifiAf83Data;