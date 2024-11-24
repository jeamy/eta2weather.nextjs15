'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData, storeError } from '@/redux/etaSlice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { EtaData as EtaDataType, ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
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

interface ApiResponse {
  data: EtaDataType;
  config?: ConfigState['data'];
}

const EtaData: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config = useSelector((state: RootState) => state.config);
  const etaState = useSelector((state: RootState) => state.eta);
  const [displayData, setDisplayData] = useState<Record<string, DisplayEtaValue> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const lastApiCall = useRef<number>(0);
  const etaApiRef = useRef<EtaApi | null>(null);

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
      
      // Transform the data for display
      const transformed = Object.entries(data).reduce((acc, [key, value]) => {
        const parsedValue = value as unknown as ParsedXmlData;
        acc[key] = {
          short: parsedValue.short || key,
          long: parsedValue.long || key,
          strValue: parsedValue.strValue || parsedValue.toString(),
          unit: parsedValue.unit || ''
        };
        return acc;
      }, {} as Record<string, DisplayEtaValue>);

      // Ensure HT, DT, and AA are present with default values if missing
      const requiredKeys = ['HT', 'DT', 'AA'];
      requiredKeys.forEach(key => {
        if (!transformed[key]) {
          transformed[key] = {
            short: key,
            long: key,
            strValue: 'Aus',
            unit: ''
          };
        }
      });

      setDisplayData(transformed);
      dispatch(storeEtaData(data));

      // Update config in Redux if provided
      if (updatedConfig) {
        dispatch(storeConfigData(updatedConfig));
      }
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
      const transformed = Object.entries(etaState.data).reduce((acc, [key, value]) => {
        acc[key] = {
          short: value.short || key,
          long: value.long || key,
          strValue: value.strValue || value.toString(),
          unit: value.unit || ''
        };
        return acc;
      }, {} as Record<string, DisplayEtaValue>);

      // Ensure HT, DT, and AA are present with default values if missing
      const requiredKeys = ['HT', 'DT', 'AA'];
      requiredKeys.forEach(key => {
        if (!transformed[key]) {
          transformed[key] = {
            short: key,
            long: key,
            strValue: 'Aus',
            unit: ''
          };
        }
      });

      setDisplayData(transformed);
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

  const handleToggle = (key: HeatingKey) => {
    if (!displayData || !displayData.HT || !displayData.DT || !displayData.AA) {
      console.error('Display data is not properly initialized');
      return;
    }

    const newDisplayData = {
      HT: { ...displayData.HT },
      DT: { ...displayData.DT },
      AA: { ...displayData.AA }
    };

    if (key === 'AA') {
      // Only allow turning AA "Ein" if it's currently "Aus"
      if (displayData.AA.strValue === 'Aus') {
        newDisplayData.AA.strValue = 'Ein';
        newDisplayData.HT.strValue = 'Aus';
        newDisplayData.DT.strValue = 'Aus';
      }
    } else {
      // Handle HT or DT clicks
      if (displayData[key].strValue === 'Ein') {
        // If button was "Ein", turn it "Aus"
        newDisplayData[key].strValue = 'Aus';
        // If both are now "Aus", AA becomes "Ein"
        if (newDisplayData.HT.strValue === 'Aus' && newDisplayData.DT.strValue === 'Aus') {
          newDisplayData.AA.strValue = 'Ein';
        }
      } else {
        // If button was "Aus", turn it "Ein" and the other one "Aus"
        newDisplayData.HT.strValue = key === 'HT' ? 'Ein' : 'Aus';
        newDisplayData.DT.strValue = key === 'DT' ? 'Ein' : 'Aus';
        newDisplayData.AA.strValue = 'Aus';
      }
    }

    // Update the display
    setDisplayData(newDisplayData);

    // Update the server state
    if (etaApiRef.current && defaultNames2Id) {
      const ht = newDisplayData.HT.strValue === 'Ein' ? 1 : 0;
      const dt = newDisplayData.DT.strValue === 'Ein' ? 1 : 0;
      const aa = newDisplayData.AA.strValue === 'Ein' ? 1 : 0;

      updateHeating(ht, aa, dt, defaultNames2Id, etaApiRef.current)
        .then(response => {
          if (!response.success) {
            console.error('Failed to update heating:', response.error);
          }
        });
    }
  };

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
                if (!value.strValue || value.strValue.trim() === '') return false;
                return true;
              })
              .sort(([_, a], [__, b]) => {
                const order: Record<string, number> = { 
                  SP: 1, AT: 2, KZ: 3, VT: 4, HK: 5, 
                  IP: 6, VR: 7, SZ: 8, EAT: 9, HT: 10, AA: 11, DT: 12
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
                              : ''
                          : value.short === 'AT'
                            ? Number(value.strValue) < 0
                              ? 'text-blue-500'
                              : 'text-green-500'
                            : ''
                      }`}>
                        {value.strValue}
                        {value.unit && <span className="text-gray-600 ml-1">{value.unit}</span>}
                      </span>
                      {(value.short === 'HT' || value.short === 'DT' || value.short === 'AA') && (
                        <button
                          role="switch"
                          aria-checked={value.strValue === 'Ein'}
                          onClick={() => {
                            if (isHeatingKey(value.short)) {
                              handleToggle(value.short);
                            } else {
                              console.error('Invalid heating key:', value.short);
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            value.strValue === 'Ein' ? 'bg-green-600' : 'bg-red-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              value.strValue === 'Ein' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
