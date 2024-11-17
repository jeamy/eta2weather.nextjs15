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

      // Update config with diff if present
      if (data.diff !== undefined) {
        const numericDiff = Number(data.diff);
        const updatedConfig = {
          ...config.data,
          [ConfigKeys.DIFF]: numericDiff.toString()
        };
        dispatch(storeData(updatedConfig));
      }
    } catch (error) {
      console.error('Error fetching WifiAf83 data:', error);
      dispatch({ type: 'wifiAf83/storeError', payload: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, config.data, setIsLoading]);

  // Calculate diff only on initial data load and visibility change
  useEffect(() => {
    const calculateAndUpdateDiff = async () => {
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
        const newDiffValue = numericDiff.toString();
        
        // Get fresh ETA data before calculating slider position
        const freshEtaData = await loadAndStoreEta();
        
        // Calculate new slider position using fresh ETA state values
        const etaValues = {
          einaus: getEtaValue(EtaConstants.EIN_AUS_TASTE, freshEtaData),
          schaltzustand: getEtaValue(EtaConstants.SCHALTZUSTAND, freshEtaData),
          kommenttaste: getEtaValue(EtaConstants.KOMMENTASTE, freshEtaData),
          tes: parseFloat(getEtaValue(EtaConstants.SCHIEBERPOS, freshEtaData)),
          tea: parseFloat(getEtaValue(EtaConstants.AUSSENTEMP, freshEtaData))
        };

//        console.log('Raw ETA state:', freshEtaData || etaState.data);
//        console.log('ETA state values:', etaValues);
        
        const newSliderPosition = calculateNewSliderPosition(etaValues, numericDiff);
        console.log('Calculated new slider position:', newSliderPosition);
        
        // Update local state with both diff and slider position
        dispatch(storeData({
          ...config.data,
          [ConfigKeys.DIFF]: newDiffValue,
          [ConfigKeys.T_SLIDER]: newSliderPosition
        }));

        // Save changes to file
        saveConfigValue(ConfigKeys.DIFF, newDiffValue);
        saveConfigValue(ConfigKeys.T_SLIDER, newSliderPosition);
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
  }, [wifiData, etaState.data, config, isLoading, saveConfigValue,
    dispatch, loadAndStoreEta, getEtaValue]);

  // Update diff when t_soll or t_delta changes
  useEffect(() => {
    const calculateAndUpdateDiff = async () => {
      if (!wifiData || !etaState.data || isLoading) {
        return;
      }

      const tSollChanged = config.data.t_soll !== lastTSoll.current;
      const tDeltaChanged = config.data.t_delta !== lastTDelta.current;

      if (tSollChanged || tDeltaChanged) {
        const tempDiff = calculateTemperatureDiff(config, {
          data: wifiData,
          loadingState: {
            isLoading: false,
            error: null
          }
        });

        if (tempDiff.diff !== null) {
          const numericDiff = tempDiff.diff;
          const newDiffValue = numericDiff.toString();
          
          // Get fresh ETA data before calculating slider position
          const freshEtaData = await loadAndStoreEta();
          
          // Calculate new slider position using fresh ETA state values
          const etaValues = {
            einaus: getEtaValue(EtaConstants.EIN_AUS_TASTE, freshEtaData),
            schaltzustand: getEtaValue(EtaConstants.SCHALTZUSTAND, freshEtaData),
            kommenttaste: getEtaValue(EtaConstants.KOMMENTASTE, freshEtaData),
            tes: parseFloat(getEtaValue(EtaConstants.SCHIEBERPOS, freshEtaData)),
            tea: parseFloat(getEtaValue(EtaConstants.AUSSENTEMP, freshEtaData))
          };

//          console.log('Raw ETA state:', freshEtaData || etaState.data);
//          console.log('ETA state values:', etaValues);
          
          const newSliderPosition = calculateNewSliderPosition(etaValues, numericDiff);
          console.log('Calculated new slider position:', newSliderPosition);
          
          // Update local state with both diff and slider position
          dispatch(storeData({
            ...config.data,
            [ConfigKeys.DIFF]: newDiffValue,
            [ConfigKeys.T_SLIDER]: newSliderPosition
          }));

          // Save changes to file
          if (tSollChanged) {
            saveConfigValue(ConfigKeys.T_SOLL, config.data.t_soll);
          }
          if (tDeltaChanged) {
            saveConfigValue(ConfigKeys.T_DELTA, config.data.t_delta);
          }
          saveConfigValue(ConfigKeys.DIFF, newDiffValue);
          saveConfigValue(ConfigKeys.T_SLIDER, newSliderPosition);
        }
        lastTSoll.current = config.data.t_soll;
        lastTDelta.current = config.data.t_delta;
      }
    };

    calculateAndUpdateDiff();
  }, [config.data.t_soll, config.data.t_delta, wifiData, saveConfigValue, 
    etaState.data, config, isLoading, dispatch, loadAndStoreEta, getEtaValue]);

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