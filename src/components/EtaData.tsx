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
import * as Switch from '@radix-ui/react-switch';

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
  const [showHT, setShowHT] = useState(false);
  const [showKT, setShowKT] = useState(false);
  const isFirstLoad = useRef(true);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const lastApiCall = useRef<number>(0);

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
//      console.log(`Setting update timer to ${safeTimer}ms`);
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
                if (key === 'HT' && !showHT) return false;
                if (key === 'KT' && !showKT) return false;
                return true;
              })
              .sort(([_, a], [__, b]) => {
                const order: Record<string, number> = { 
                  SP: 1, AT: 2, KZ: 3, VT: 4, HK: 5, 
                  IP: 6, VR: 7, SZ: 8, EAT: 9, HT: 10, KT: 11 
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
                      {value.short === 'HT' && (
                        <Switch.Root
                          checked={showHT}
                          onCheckedChange={setShowHT}
                          className={`${
                            showHT ? 'bg-blue-600' : 'bg-gray-200'
                          } relative w-11 h-6 rounded-full outline-none cursor-default`}
                        >
                          <Switch.Thumb 
                            className={`
                              block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-1
                              ${showHT ? 'translate-x-6' : ''}
                            `}
                          />
                        </Switch.Root>
                      )}
                      {value.short === 'KT' && (
                        <Switch.Root
                          checked={showKT}
                          onCheckedChange={setShowKT}
                          className={`${
                            showKT ? 'bg-blue-600' : 'bg-gray-200'
                          } relative w-11 h-6 rounded-full outline-none cursor-default`}
                        >
                          <Switch.Thumb 
                            className={`
                              block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-1
                              ${showKT ? 'translate-x-6' : ''}
                            `}
                          />
                        </Switch.Root>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center min-h-[200px]">
          <p className="text-red-500">No data available</p>
        </div>
      )}
    </div>
  );
};

export default EtaData;
