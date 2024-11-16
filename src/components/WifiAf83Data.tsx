'use client';

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError } from '@/redux/wifiAf83Slice';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';

interface Temperature {
  time: string;
  unit: string;
  value: string;
}

interface WifiResponse {
  code: number;
  msg: string;
  time: number;
  data: {
    outdoor: {
      temperature: Temperature;
    };
    indoor: {
      temperature: Temperature;
    };
  };
  datestring: string;
  diff: string;
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const WifiAf83Data: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config: ConfigState = useSelector((state: RootState) => state.config);
  const [wifiData, setWifiData] = useState<WifiResponse | null>(null);

  useEffect(() => {
    const loadAndStoreWifi = async () => {
      try {
        const response = await fetch('/api/wifi');
        const data: WifiResponse = await response.json();
        setWifiData(data);
        // Store the data directly since it already has the required properties
        dispatch(storeData(data));
      } catch (error) {
        const typedError = error as Error;
        console.error('Error fetching WiFi data:', typedError);
        dispatch(storeError(typedError.message));
      }
    };
    loadAndStoreWifi();
  }, [dispatch]);

  if (!wifiData) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-col items-start">
      <h1 className="text-2xl py-5">WiFi AF83 Daten:</h1>
      <div className="space-y-2">
        <div>
          <h3 className="font-semibold">Outdoor</h3>
          <p>
            Temperatur: {wifiData.data.outdoor.temperature.value.replace('*', '')} {wifiData.data.outdoor.temperature.unit}
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Indoor</h3>
          <p>
            Temperatur: {wifiData.data.indoor.temperature.value.replace('*', '')} {wifiData.data.indoor.temperature.unit}
          </p>
        </div>
        <div className="pt-2 border-t border-gray-200">
          <p>
            Datum: {formatDate(wifiData.time)}
          </p>
          <p>
            Diff: {wifiData.diff}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WifiAf83Data;