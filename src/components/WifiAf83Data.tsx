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
  });
};

const WifiAf83Data: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config);
  const etaState = useSelector((state: RootState) => state.eta);
  const [wifiData, setWifiData] = useState<WifiAF83Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const lastApiCall = useRef<number>(0);
  const lastTSoll = useRef(config.data.t_soll);
  const lastTDelta = useRef(config.data.t_delta);

  const getEtaValue = useCallback((shortKey: string, etaData: Record<string, any> | null): string => {
    const stateData = etaData ? etaData[defaultNames2Id[shortKey].id] : etaState.data[defaultNames2Id[shortKey].id];
    if (!stateData) {
      console.warn(`Missing ETA state data for ${shortKey} (${defaultNames2Id[shortKey].id})`);
      return "Aus";
    }
    
    // Get the actual value from the parsed XML data
    const value = stateData.strValue;
    if (!value) {
      console.warn(`Missing strValue in ETA state data for ${shortKey}`);
      return "Aus";
    }
    
    return value;
  }, [etaState.data]);

  const saveConfigValue = useCallback(async (key: ConfigKeys, value: string) => {
    try {
      const response = await fetch('/api/config/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }, []);

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

      // Calculate temperature difference and update slider position
      if (etaState.data) {
        const { diff: numericDiff } = calculateTemperatureDiff(config, { 
          data: transformedData,
          loadingState: {
            isLoading: false,
            error: null
          }
        });
        
        if (numericDiff !== null) {
          const newDiffValue = numericDiff.toString();

          const etaValues = {
            einaus: etaState.data[defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id]?.strValue || '0',
            schaltzustand: etaState.data[defaultNames2Id[EtaConstants.SCHALTZUSTAND].id]?.strValue || '0',
            kommenttaste: etaState.data[defaultNames2Id[EtaConstants.KOMMENTASTE].id]?.strValue || '0',
            tes: Number(etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id]?.strValue || '0'),
            tea: Number(etaState.data[defaultNames2Id[EtaConstants.AUSSENTEMP].id]?.strValue || '0'),
          };

          console.log('etaValues:', etaValues);
          const newSliderPosition = calculateNewSliderPosition(etaValues, numericDiff);
          console.log('Calculated new slider position:', newSliderPosition);
          
          // Update local state with both diff and slider position
          dispatch(storeData({
            ...config.data,
            [ConfigKeys.DIFF]: newDiffValue,
            [ConfigKeys.T_SLIDER]: newSliderPosition
          }));
        } else {
          console.warn('Temperature difference calculation returned null');
        }
      }
    } catch (error) {
      console.error('Error fetching WifiAF83 data:', error);
      dispatch({ type: 'wifiAf83/storeError', payload: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, config, etaState.data, setIsLoading]);

  // Initial load and timer setup
  useEffect(() => {
    loadAndStoreWifi();

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

  if (isLoading || !wifiData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col items-start">
      <h1 className="text-2xl py-5">WiFi AF83 Daten:</h1>
      <table className="border-collapse border border-gray-300 w-[400px]">
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="px-4 py-2 w-[100px] border-r border-gray-200">Außentemperatur</td>
            <td className="px-4 py-2 w-[200px] text-right">
              <span className="font-mono">{wifiData.temperature.toFixed(1)}</span>
              <span className="ml-1 text-gray-600">°C</span>
            </td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="px-4 py-2 w-[100px] border-r border-gray-200">Innentemperatur</td>
            <td className="px-4 py-2 w-[200px] text-right">
              <span className="font-mono">{wifiData.indoorTemperature.toFixed(1)}</span>
              <span className="ml-1 text-gray-600">°C</span>
            </td>
          </tr>
          {config.data[ConfigKeys.DIFF] && (
            <tr className="border-b border-gray-200">
              <td className="px-4 py-2 w-[100px] border-r border-gray-200">Diff Soll/Innentemperatur</td>
              <td className="px-4 py-2 w-[200px] text-right">
                <span className={`font-mono ${
                  Number(config.data[ConfigKeys.DIFF]) > 0 
                    ? 'text-green-600' 
                    : Number(config.data[ConfigKeys.DIFF]) < 0 
                      ? 'text-red-600' 
                      : 'text-gray-900'
                }`}>
                  {Number(config.data[ConfigKeys.DIFF]).toFixed(1)}
                </span>
                <span className="ml-1 text-gray-600">°C</span>
              </td>
            </tr>
          )}
          <tr className="border-b border-gray-200">
            <td className="px-4 py-2 w-[100px] border-r border-gray-200">Datum</td>
            <td className="px-4 py-2 w-[200px] text-right">
              <span className="font-mono">{formatDateTime(wifiData.time)}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default WifiAf83Data;