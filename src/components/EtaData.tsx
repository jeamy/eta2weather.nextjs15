'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { EtaData as EtaDataType, EtaPos, EtaText, EtaButtons } from '@/reader/functions/types-constants/EtaConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import Image from 'next/image';
import { EtaApi } from '@/reader/functions/EtaApi';
import { defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';

// Constants

interface DisplayEtaValue {
  short: string;
  long: string;
  strValue: string;
  unit: string;
}

type DisplayDataType = {
  [key: string]: DisplayEtaValue;
};

interface ApiResponse {
  data: EtaDataType;
  config?: ConfigState['data'];
}

const EtaData: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config.data);
  const etaState = useSelector((state: RootState) => state.eta);
  const wifiState = useSelector((state: RootState) => state.wifiAf83);
  const [loadingState, setLoadingState] = useState({ isLoading: true, error: '' });
  const isFirstLoad = useRef(true);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const lastApiCall = useRef<number>(0);
  const etaApiRef = useRef<EtaApi | null>(null);

  // Type for the button state
  type ButtonState = {
    button: EtaButtons;
    manual: boolean;
  };

  const [displayData, setDisplayData] = useState<DisplayDataType | null>(null);

  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    if (config?.s_eta) {
      etaApiRef.current = new EtaApi(config.s_eta);
    }
  }, [config]);

  const loadAndStoreEta = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    if (!force && now - lastApiCall.current < MIN_API_INTERVAL) {
      console.log('Skipping API call - too frequent');
      return;
    }

    try {
      setLoadingState({ isLoading: true, error: '' });
      lastApiCall.current = now;

      const response = await fetch('/api/eta/read', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ETA data: ${response.statusText}`);
      }

      const { data, config: updatedConfig } = await response.json() as ApiResponse;

      // Update the Redux store
      dispatch(storeEtaData(data));

      if (updatedConfig) {
        dispatch(storeConfigData(updatedConfig));
      }

      // Let the useEffect handle the display data update
    } catch (error) {
      console.error('Error fetching ETA data:', error);
      setLoadingState({ isLoading: false, error: (error as Error).message });
    } finally {
      setLoadingState({ isLoading: false, error: '' });
    }
  }, [dispatch]);

  // Initial load effect
  useEffect(() => {
    if (isFirstLoad.current) {
      loadAndStoreEta();
      isFirstLoad.current = false;
    }
  }, [loadAndStoreEta]);

  // Update display data when etaState changes
  useEffect(() => {
    if (!etaState.data) return;

//    console.log('Raw ETA State Data:', JSON.stringify(etaState.data, null, 2));

    setDisplayData(prevData => {
      const newDisplayData: DisplayDataType = {};  // Start fresh each time
      
      Object.values(etaState.data).forEach(entry => {
        if (Object.values(EtaButtons).includes(entry.short as EtaButtons)) {
          console.log(`Processing button ${entry.short}: value=${entry.value}, strValue=${entry.strValue}`);
          newDisplayData[entry.short || ' '] = {
            short: entry.short || 'Unknown',
            long: entry.long || entry.short || 'Unknown',
            strValue: entry.value === EtaPos.EIN ? EtaText.EIN : EtaText.AUS,
            unit: entry.unit || ''
          };
        }
      });
      
      console.log('New Display Data:', JSON.stringify(newDisplayData, null, 2));
      return newDisplayData;  // Replace entire state instead of merging
    });
  }, [etaState.data]);

  const updateButtonStates = useCallback(async (activeButton: EtaButtons, isManual: boolean = false) => {
    try {
      // Find button IDs from state data
      const buttonIds: Record<string, string> = {};
      Object.entries(etaState.data).forEach(([uri, data]) => {
        if (Object.values(EtaButtons).includes(data.short as EtaButtons)) {
          buttonIds[data.short ?? ''] = uri;
        }
      });

      if (!buttonIds[activeButton]) {
        throw new Error(`Button ID not found for ${activeButton}`);
      }

      // Turn off all other buttons first
      const allButtons = Object.entries(buttonIds).filter(([name]) => name !== activeButton);
      
      console.log(`Turning off all other buttons: ${allButtons.map(([name]) => name).join(', ')}`);
      
      // Turn off buttons one by one to ensure each request completes
      for (const [name, id] of allButtons) {
        console.log(`Turning off button: ${name}`);
        const response = await fetch('/api/eta/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: id,
            value: EtaPos.AUS,
            begin: "0",
            end: "0"
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to turn off button ${name}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(`Failed to turn off button ${name}: ${result.error}`);
        }

        // Wait a short time between requests to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Then activate the requested button
      console.log(`Activating button: ${activeButton}`);
      const response = await fetch('/api/eta/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: buttonIds[activeButton],
          value: EtaPos.EIN,
          begin: "0",
          end: "0"
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to activate button ${activeButton}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(`Failed to activate button ${activeButton}: ${result.error}`);
      }

      // Update manual override state
      setManualOverride(isManual);

      // Wait a moment to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 200));

      // Refresh the data to get the new state
      await loadAndStoreEta(true);

    } catch (error) {
      console.error('Error updating button states:', error);
      setLoadingState(prev => ({ ...prev, error: (error as Error).message }));
    }
  }, [etaState.data, loadAndStoreEta]);

  const handleButtonClick = useCallback(async (clickedButton: EtaButtons) => {
    setManualOverride(true);  // Set manual override when button is clicked
    await updateButtonStates(clickedButton, true);
  }, [updateButtonStates]);

  const lastTempState = useRef<{
    wasBelow: boolean | null;
  }>({ wasBelow: null });

  useEffect(() => {
    const checkTemperature = async () => {
      if (!wifiState.data?.indoorTemperature || !config.t_min) return;

      const indoorTemp = wifiState.data.indoorTemperature;
      const minTemp = Number(config.t_min);
      
      if (isNaN(indoorTemp) || isNaN(minTemp)) return;

      const isBelow = indoorTemp < minTemp;

      // Only act if the temperature crosses the threshold
      if (lastTempState.current.wasBelow !== null && lastTempState.current.wasBelow !== isBelow) {
        if (isBelow) {
          console.log(`Temperature crossed below minimum: indoor=${indoorTemp}°C, min=${minTemp}°C -> activating Kommen`);
          await updateButtonStates(EtaButtons.KT, false);
        } else {
          console.log(`Temperature crossed above minimum: indoor=${indoorTemp}°C, min=${minTemp}°C -> activating Auto`);
          await updateButtonStates(EtaButtons.AA, false);
        }
      }

      // Update the last temperature state
      lastTempState.current.wasBelow = isBelow;
    };

    // Run temperature check
    checkTemperature();
  }, [wifiState.data?.indoorTemperature, config.t_min, updateButtonStates]);

  // Reset manual override after a certain time (e.g., 1 hour)
  useEffect(() => {
    if (manualOverride) {
      const timer = setTimeout(() => {
        setManualOverride(false);
        console.log('Manual override timeout: resuming automatic temperature control');
      }, 60 * 60 * 1000); // 1 hour

      return () => clearTimeout(timer);
    }
  }, [manualOverride]);

  useEffect(() => {
    const updateTimer = parseInt(config.t_update_timer) || DEFAULT_UPDATE_TIMER;
    if (updateTimer > 0) {
      // Ensure timer is not less than minimum interval
      const safeTimer = Math.max(updateTimer, MIN_API_INTERVAL);
      
      // Clear existing interval if any
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
      
      // Set new interval with safe timer value
      intervalId.current = setInterval(loadAndStoreEta, safeTimer);
    }
    // Cleanup function
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };
  }, [loadAndStoreEta, config.t_update_timer]);

  if (loadingState.isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
        <span className="ml-2 text-gray-600">Loading ETA data...</span>
      </div>
    );
  }

  if (loadingState.error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">Error loading data: {loadingState.error}</p>
      </div>
    );
  }

  if (!etaState.data || Object.keys(etaState.data).length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-700">No data available</p>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-4">
          <div className="h-[150px] w-full relative flex items-center justify-center">
            <Image
              src="/eta-logo.png"
              alt="ETA"
              width={150}
              height={150}
              style={{ width: 'auto', height: '150px', objectFit: 'contain' }}
              priority
            />
          </div>
          <h2 className="text-lg sm:text-xl font-semibold">ETA Data</h2>
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
            src="/eta-logo.png"
            alt="ETA"
            width={150}
            height={150}
            style={{ width: 'auto', height: '150px', objectFit: 'contain' }}
            priority
          />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold">ETA Data</h2>
      </div>
      {etaState.data ? (
        <div className="space-y-3 text-sm sm:text-base">
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(etaState.data)
              .filter(([key, value]) => {
                // Filter out HT, AA, DT entries and empty values
                if (Object.values(EtaButtons).includes(value.short as EtaButtons)) {
                  return false;
                }
                if (!value.strValue || value.strValue.trim() === '') return false;
                return true;
              })
              .sort(([_, a], [__, b]) => {
                const order: Record<string, number> = { 
                  SP: 1, AT: 2, KZ: 3, VT: 4, HK: 5, 
                  IP: 6, VR: 7, SZ: 8, EAT: 9
                };
                const aShort = a.short || '';
                const bShort = b.short || '';
                const aOrder = aShort in order ? order[aShort] : 99;
                const bOrder = bShort in order ? order[bShort] : 99;
                return aOrder - bOrder;
              })
              .map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{value.long}:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${
                        value.short === 'SP' 
                          ? Number(value.strValue) > 0 
                            ? 'text-black' 
                            : Number(value.strValue) < 0 
                              ? 'text-blue-600' 
                              : 'text-black'
                          : value.short === 'AT' || value.unit === '°C'
                            ? Number(value.strValue) > 0
                              ? 'text-black'
                              : Number(value.strValue) < 0
                                ? 'text-blue-600'
                                : 'text-black'
                            : 'text-black'
                      }`}>
                        {value.strValue}
                        {value.unit && <span className="text-gray-500">{value.unit}</span>}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            {/* Render switches separately */}
            {Object.values(EtaButtons).map(key => {
              const value = displayData[key] || { short: key, long: '', strValue: '', unit: '' };
              return (
                <div key={key} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {key === EtaButtons.HT ? 'Heizen Taste' :
                         key === EtaButtons.AA ? 'Autotaste' :
                         key === EtaButtons.DT ? 'Absenken Taste' :
                         key === EtaButtons.GT ? 'Gehen Taste' :
                         key === EtaButtons.KT ? 'Kommen Taste' :
                         value.long}:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${
                        value.strValue === EtaText.EIN ? 'text-green-500' : 
                        value.strValue === EtaText.AUS ? 'text-red-500' : 
                        'text-black'
                      }`}>
                        {value.strValue}
                      </span>
                      <button
                        onClick={() => {
                          if (isHeatingKey(key)) {
                            handleButtonClick(key);
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          value.strValue === EtaText.EIN ? 'bg-green-600' : 'bg-red-600'
                        }`}
                        role="switch"
                        aria-checked={value.strValue === EtaText.EIN}
                      >
                        <span className="sr-only">Toggle {value.long}</span>
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            value.strValue === EtaText.EIN ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center min-h-[200px]">
          <p>Loading...</p>
        </div>
      )}
    </div>
  );
};

type HeatingKey = EtaButtons;

const isHeatingKey = (key: string): key is HeatingKey => {
  return Object.values(EtaButtons).includes(key as EtaButtons);
};

export default EtaData;
