'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData, storeError } from '@/redux/etaSlice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { EtaData as EtaDataType, ParsedXmlData, EtaText, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import Image from 'next/image';
import { defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import { EtaApi } from '@/reader/functions/EtaApi';
import { updateHeating } from '@/utils/Functions';

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
  const config = useSelector((state: RootState) => state.config);
  const etaState = useSelector((state: RootState) => state.eta);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const lastApiCall = useRef<number>(0);
  const etaApiRef = useRef<EtaApi | null>(null);

  // Create default values for each switch
  const defaultValues: Record<'HT' | 'DT' | 'AA', DisplayEtaValue> = {
    HT: { 
      short: 'HT',
      long: 'Heizen Taste',
      strValue: 'Aus',
      unit: ''
    },
    DT: { 
      short: 'DT',
      long: 'Absenken Taste',
      strValue: 'Aus',
      unit: ''
    },
    AA: { 
      short: 'AA',
      long: 'Autotaste',
      strValue: 'Ein', // Default to Ein when others are Aus
      unit: ''
    }
  };

  const [displayData, setDisplayData] = useState<DisplayDataType>({
    ...defaultValues
  });

  useEffect(() => {
    etaApiRef.current = new EtaApi();
  }, []);

  const loadAndStoreEta = useCallback(async () => {
    const now = Date.now();
    if (now - lastApiCall.current < MIN_API_INTERVAL) {
      console.log('Skipping API call - too frequent');
      return;
    }

    try {
      setIsLoading(true);
      lastApiCall.current = now;

      const response = await fetch('/api/eta/read');
      if (!response.ok) {
        throw new Error('Failed to fetch ETA data');
      }

      const { data, config: updatedConfig } = await response.json() as ApiResponse;
      
      // Update the Redux store
      dispatch(storeEtaData(data));

      // Update config in Redux if provided
      if (updatedConfig) {
        dispatch(storeConfigData(updatedConfig));
      }

      // Let the useEffect handle the display data update
    } catch (error) {
      console.error('Error fetching ETA data:', error);
      dispatch(storeError((error as Error).message));
    } finally {
      setIsLoading(false);
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
    if (etaState.data) {
      // Get raw values first
      const htRawValue = typeof etaState.data.HT === 'object' && 'strValue' in etaState.data.HT
        ? etaState.data.HT.strValue === EtaPos.EIN
        : String(etaState.data.HT) === EtaPos.EIN;

      const dtRawValue = typeof etaState.data.DT === 'object' && 'strValue' in etaState.data.DT
        ? etaState.data.DT.strValue === EtaPos.EIN
        : String(etaState.data.DT) === EtaPos.EIN;

      const aaRawValue = typeof etaState.data.AA === 'object' && 'strValue' in etaState.data.AA
        ? etaState.data.AA.strValue === EtaPos.EIN
        : String(etaState.data.AA) === EtaPos.EIN;

      // Apply business rules
      const finalHT = htRawValue;
      const finalDT = !htRawValue && dtRawValue;
      const finalAA = (!htRawValue && !dtRawValue) || (!htRawValue && !dtRawValue && aaRawValue);

      const newDisplayData: DisplayDataType = {
        HT: {
          ...defaultValues.HT,
          strValue: finalHT ? 'Ein' : 'Aus'
        },
        DT: {
          ...defaultValues.DT,
          strValue: finalDT ? 'Ein' : 'Aus'
        },
        AA: {
          ...defaultValues.AA,
          strValue: finalAA ? 'Ein' : 'Aus'
        }
      };

      setDisplayData(newDisplayData);
    }
  }, [etaState.data]);

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
  }, [loadAndStoreEta, config.data.t_update_timer]);

  type HeatingKey = 'HT' | 'DT' | 'AA';

  const isHeatingKey = (key: string): key is HeatingKey => {
    return ['HT', 'DT', 'AA'].includes(key);
  };

  const handleToggle = useCallback(async (key: string) => {
    if (!etaApiRef.current) return;

    const currentValue = displayData[key]?.strValue === 'Ein' ? EtaPos.EIN : EtaPos.AUS;
    const newValue = currentValue === EtaPos.EIN ? EtaPos.AUS : EtaPos.EIN;

    // Get current states
    const isHtOn = displayData.HT?.strValue === 'Ein';
    const isDtOn = displayData.DT?.strValue === 'Ein';

    // Prevent AA from being turned off if both HT and DT are off
    if (key === 'AA' && !isHtOn && !isDtOn && currentValue === EtaPos.EIN) {
      console.log('Cannot turn off Auto when both HT and DT are off');
      return;
    }

    // Update frontend state immediately
    const newDisplayData = { ...displayData };
    
    // Calculate new states based on business rules
    if (key === 'HT' && newValue === EtaPos.EIN) {
      // If turning on HT, turn off others
      newDisplayData.HT.strValue = 'Ein';
      newDisplayData.DT.strValue = 'Aus';
      newDisplayData.AA.strValue = 'Aus';
    } else if (key === 'DT' && newValue === EtaPos.EIN) {
      // If turning on DT, turn off others
      newDisplayData.HT.strValue = 'Aus';
      newDisplayData.DT.strValue = 'Ein';
      newDisplayData.AA.strValue = 'Aus';
    } else if (key === 'AA' && newValue === EtaPos.EIN) {
      // If turning on AA, turn off others
      newDisplayData.HT.strValue = 'Aus';
      newDisplayData.DT.strValue = 'Aus';
      newDisplayData.AA.strValue = 'Ein';
    } else {
      // Turning something off
      newDisplayData[key].strValue = 'Aus';
      // If both HT and DT are off, turn on AA
      if (key !== 'AA' && newDisplayData.HT.strValue === 'Aus' && newDisplayData.DT.strValue === 'Aus') {
        newDisplayData.AA.strValue = 'Ein';
      }
    }

    // Update the display immediately
    setDisplayData(newDisplayData);

    try {
      const varId = defaultNames2Id[key]?.id;
      if (!varId) {
        console.warn(`No ID found for key: ${key}`);
        return;
      }

      // Calculate new states for all switches
      const ht = key === 'HT' ? (newValue === EtaPos.EIN ? 1 : 0) : (displayData.HT.strValue === 'Ein' ? 1 : 0);
      const auto = key === 'AA' ? (newValue === EtaPos.EIN ? 1 : 0) : (displayData.AA.strValue === 'Ein' ? 1 : 0);
      const ab = key === 'DT' ? (newValue === EtaPos.EIN ? 1 : 0) : (displayData.DT.strValue === 'Ein' ? 1 : 0);

      // Update all switches at once
      const result = await updateHeating(ht, auto, ab, defaultNames2Id, etaApiRef.current);
      
      if (!result.success) {
        console.error('Error updating heating:', result.error);
        return;
      }

      // Only refresh data from server after a short delay
      setTimeout(() => {
        loadAndStoreEta();
      }, 500);
    } catch (error) {
      // Log but don't throw
      console.warn(`Error toggling ${key}:`, error);
      // Don't revert the state - let the background sync handle it
    }
  }, [displayData, defaultNames2Id, loadAndStoreEta]);

  type SwitchKeys = 'HT' | 'DT' | 'AA';
  interface DisplayDataType extends Record<string, DisplayEtaValue> {
    HT: DisplayEtaValue;
    DT: DisplayEtaValue;
    AA: DisplayEtaValue;
  }

  useEffect(() => {
    const updateDisplayData = () => {
      if (!etaState.data || !defaultNames2Id) return;

      // Start with the current switch states
      const newDisplayData: DisplayDataType = {
        ...displayData, // Keep existing data
        HT: displayData.HT,
        DT: displayData.DT,
        AA: displayData.AA
      };

      // Add filtered data
      Object.entries(etaState.data).forEach(([key, value]) => {
        if (
          (newDisplayData.HT.strValue === 'Ein' && value.type === 'HT') ||
          (newDisplayData.DT.strValue === 'Ein' && value.type === 'DT') ||
          (newDisplayData.AA.strValue === 'Ein' && value.type === 'AA')
        ) {
          newDisplayData[key] = {
            short: value.type,
            long: defaultNames2Id[key]?.name || key,
            strValue: value.strValue,
            unit: value.unit || ''
          };
        }
      });

      setDisplayData(newDisplayData);
    };

    updateDisplayData();
  }, [etaState.data, defaultNames2Id, displayData.HT.strValue, displayData.DT.strValue, displayData.AA.strValue]);

  if (isLoading || !displayData) {
    return (
      <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-4">
          <div className="h-[150px] w-full relative flex items-center justify-center">
            <Image
              src="/eta-logo.png"
              alt="ETA"
              width={150}
              height={150}
              style={{ objectFit: 'contain' }}
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
            style={{ objectFit: 'contain' }}
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
                if (value.short === 'HT' || value.short === 'DT' || value.short === 'AA') {
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
                const aOrder = a.short in order ? order[a.short] : 99;
                const bOrder = b.short in order ? order[b.short] : 99;
                return aOrder - bOrder;
              })
              .map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-500">{value.short}</span>
                      <span className="font-medium">{value.long}:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${
                        value.short === 'SP' 
                          ? Number(value.strValue) > 0 
                            ? 'text-green-600' 
                            : Number(value.strValue) < 0 
                              ? 'text-blue-600' 
                              : 'text-black'
                          : value.short === 'AT'
                            ? Number(value.strValue) < 0
                              ? 'text-blue-500'
                              : 'text-green-500'
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
            {['HT', 'AA', 'DT'].map(key => {
              const value = displayData[key] || defaultValues[key as HeatingKey];
              return (
                <div key={key} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-500">{value.short}</span>
                      <span className="font-medium">
                        {key === 'HT' ? 'Heizen Taste' :
                         key === 'AA' ? 'Autotaste' :
                         key === 'DT' ? 'Absenken Taste' :
                         value.long}:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${
                        value.strValue === 'Ein' ? 'text-green-500' : 
                        value.strValue === 'Aus' ? 'text-red-500' : 
                        'text-black'
                      }`}>
                        {value.strValue}
                      </span>
                      <button
                        onClick={() => {
                          if (isHeatingKey(key)) {
                            handleToggle(key as HeatingKey);
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          value.strValue === 'Ein' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                        role="switch"
                        aria-checked={value.strValue === 'Ein'}
                      >
                        <span className="sr-only">Toggle {value.long}</span>
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            value.strValue === 'Ein' ? 'translate-x-6' : 'translate-x-1'
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

export default EtaData;
