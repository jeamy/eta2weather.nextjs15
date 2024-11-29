'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import { calculateTemperatureDiff, calculateNewSliderPosition } from '@/utils/Functions';
import { storeData } from '@/redux/configSlice';
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';
import { EtaConstants, defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import Image from 'next/image';

interface ApiResponse {
  data: WifiAF83Data & {
    diff?: string;
  };
  config?: ConfigState['data'];
}

const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

const WifiAf83Data: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config);
  const etaState = useSelector((state: RootState) => state.eta);
  const [wifiData, setWifiData] = useState<WifiAF83Data | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFirstLoad = useRef(true);
  const lastApiCall = useRef<number>(0);
  const lastTSoll = useRef(config.data.t_soll);
  const lastTDelta = useRef(config.data.t_delta);

  const saveConfigValue = useCallback(async (key: ConfigKeys, value: string | number) => {
    try {
      const response = await fetch('/api/config/update', {
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
    } catch (error) {
      console.error('Error saving config value:', error);
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

      const response = await fetch('/api/wifiaf83/read');
      if (!response.ok) {
        throw new Error('Failed to fetch WifiAF83 data');
      }

      const { data } = await response.json() as ApiResponse;

      const transformedData: WifiAF83Data = {
        time: Number(data.time),
        datestring: data.datestring,
        temperature: Number(data.temperature),
        indoorTemperature: Number(data.indoorTemperature)
      };

      setWifiData(transformedData);
      dispatch({ type: 'wifiAf83/storeData', payload: transformedData });
    } catch (error) {
      console.error('Error fetching WifiAF83 data:', error);
      dispatch({ type: 'wifiAf83/storeError', payload: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, setIsLoading]);

  const updateTemperatureDiff = useCallback(async () => {
    if (!config.isInitialized || !wifiData || !etaState.data) {
      return;
    }

    const { diff: numericDiff } = calculateTemperatureDiff(config, { 
      data: wifiData,
      loadingState: {
        isLoading: false,
        error: null
      }
    });
    
    if (numericDiff !== null) {
      const newDiffValue = numericDiff.toString();
      // Only update if the diff value has changed
      if (newDiffValue !== config.data[ConfigKeys.DIFF]) {
        const etaValues = {
          einaus: etaState.data[defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id]?.strValue || '0',
          schaltzustand: etaState.data[defaultNames2Id[EtaConstants.SCHALTZUSTAND].id]?.strValue || '0',
          heizentaste: etaState.data[defaultNames2Id[EtaConstants.HEIZENTASTE].id]?.strValue || '0',
          tes: Number(etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id]?.strValue || '0'),
          tea: Number(etaState.data[defaultNames2Id[EtaConstants.AUSSENTEMP].id]?.strValue || '0'),
        };

        const newSliderPosition = calculateNewSliderPosition(etaValues, numericDiff);
        
        if (newSliderPosition !== config.data[ConfigKeys.T_SLIDER] || newDiffValue !== config.data[ConfigKeys.DIFF]) {
          dispatch(storeData({
            ...config.data,
            [ConfigKeys.DIFF]: newDiffValue,
            [ConfigKeys.T_SLIDER]: newSliderPosition
          }));
        }
      }
    }
  }, [config, wifiData, etaState.data, dispatch]);

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

  // Update temperature diff only when temperatures change
  useEffect(() => {
    if (config.isInitialized && wifiData && etaState.data) {
      updateTemperatureDiff();
    }
  }, [config.isInitialized, wifiData, etaState.data, updateTemperatureDiff]);

  const loadAndStoreEta = useCallback(async () => {
    try {
      const response = await fetch('/api/eta/read');
      if (!response.ok) {
        throw new Error('Failed to fetch ETA data');
      }
      const { data } = await response.json();
      dispatch({ type: 'eta/storeData', payload: data });
      return data;
    } catch (error) {
      console.error('Error fetching ETA data:', error);
      return null;
    }
  }, [dispatch]);

  useEffect(() => {
    loadAndStoreEta();
  }, [loadAndStoreEta]);

  if (isLoading || !wifiData) {
    return (
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-4">
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
        <div className="flex justify-center items-center min-h-[200px]">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md">
      <div className="flex flex-col items-center mb-4">
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
            <div className="flex justify-between items-center">
              <span className="font-medium">Außentemperatur:</span>
              <span className={`font-mono ${wifiData.temperature < 0 ? 'text-blue-500' : 'text-green-500'}`}>
                {wifiData.temperature}°C
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Innentemperatur:</span>
              <span className="font-mono">{wifiData.indoorTemperature}°C</span>
            </div>
            {config.data[ConfigKeys.DIFF] && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Diff Soll/Indoor:</span>
                <span className={`font-mono ${
                  Number(config.data[ConfigKeys.DIFF]) > 0 
                    ? 'text-green-600' 
                    : Number(config.data[ConfigKeys.DIFF]) < 0 
                      ? 'text-blue-600' 
                      : ''
                }`}>
                  {Number(config.data[ConfigKeys.DIFF]).toFixed(1)}°C
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-col">
            <span className="font-medium">Last Update:</span>
            <span className="text-xs sm:text-sm text-gray-600">
              {formatDateTime(wifiData.time)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WifiAf83Data;