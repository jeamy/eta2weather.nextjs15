'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData, storeError } from '@/redux/etaSlice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { EtaData as EtaDataType, EtaPos, EtaText } from '@/reader/functions/types-constants/EtaConstants';
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
  const [loadingState, setLoadingState] = useState({ isLoading: true, error: '' });
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

  // Initialize displayData with default values
  const [displayData, setDisplayData] = useState<DisplayDataType>(() => ({
    HT: defaultValues.HT,
    DT: defaultValues.DT,
    AA: defaultValues.AA,
  }));

  useEffect(() => {
    if (config?.s_eta) {
      etaApiRef.current = new EtaApi(config.s_eta);
    }
  }, [config]);

  const loadAndStoreEta = useCallback(async () => {
    const now = Date.now();
    if (now - lastApiCall.current < MIN_API_INTERVAL) {
      console.log('Skipping API call - too frequent');
      return;
    }

    try {
      setLoadingState({ isLoading: true, error: '' });
      lastApiCall.current = now;

      const response = await fetch('/api/eta/read');
      if (!response.ok) {
        throw new Error('Failed to fetch ETA data');
      }

      const { data, config: updatedConfig } = await response.json() as ApiResponse;

//      console.log('Received ETA data:', data);
      // Update the Redux store
      dispatch(storeEtaData(data));

      // Update config in Redux if provided
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
    if (etaState.data) {
//      console.log('Received etaState data:', etaState.data);
      setDisplayData(prevData => {
        const newDisplayData: DisplayDataType = { ...prevData };
        
        Object.values(etaState.data).forEach(entry => {
          if (entry.short === 'HT' || entry.short === 'DT' || entry.short === 'AA') {
            newDisplayData[entry.short] = {
              short: entry.short || 'Unknown',
              long: entry.long || entry.short,
              strValue: entry.value === EtaPos.EIN ? EtaText.EIN : EtaText.AUS,
              unit: entry.unit || ''
            };
          }
        });
        
        return newDisplayData;
      });
    }
  }, [etaState.data]);

  useEffect(() => {
    const updateDisplayData = () => {
      if (!etaState.data || !defaultNames2Id) return;

      setDisplayData(prevData => {
        const newDisplayData: DisplayDataType = {
          ...prevData
        };

        // Update values from etaState
        Object.entries(etaState.data).forEach(([key, value]) => {
          if (
            value &&
            typeof value === 'object' &&
            'type' in value &&
            'strValue' in value
          ) {
            newDisplayData[key] = {
              short: value.type || 'Unknown',
              long: defaultNames2Id[key]?.name || key,
              strValue: value.strValue || '',
              unit: value.unit || ''
            };
          }
        });

        return newDisplayData;
      });
    };

    updateDisplayData();
  }, [etaState.data]);

  const handleButtonClick = async (clickedButton: 'HT' | 'DT' | 'AA') => {
    const newDisplayData = { ...displayData };
    
    // Reset all buttons to 'Aus' first
    Object.keys(newDisplayData).forEach(key => {
      newDisplayData[key as keyof typeof displayData].strValue = 'Aus';
    });
    
    // Set the clicked button to 'Ein'
    newDisplayData[clickedButton].strValue = 'Ein';
    
    setDisplayData(newDisplayData);
    
    try {
      // Find button IDs from state data
      const buttonIds: Record<string, string> = {};
      Object.entries(etaState.data).forEach(([uri, data]) => {
        if (data.short === 'HT' || data.short === 'DT' || data.short === 'AA') {
          buttonIds[data.short] = uri;
        }
      });

      if (!buttonIds[clickedButton]) {
        throw new Error(`Button ID not found for ${clickedButton}`);
      }

      // Set clicked button to Ein (1803)
      await fetch('/api/eta/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: buttonIds[clickedButton],
          value: "1803",
          begin: "0",
          end: "0"
        })
      });
      
      // Set other buttons to Aus (1802)
      const otherButtons = Object.keys(buttonIds).filter(key => key !== clickedButton) as Array<'HT' | 'DT' | 'AA'>;
      await Promise.all(otherButtons.map(button => 
        fetch('/api/eta/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: buttonIds[button],
            value: "1802",
            begin: "0",
            end: "0"
          })
        })
      ));
    } catch (error) {
      console.error('Error updating button state:', error);
    }
  };

  // Timer effect
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

  type HeatingKey = 'HT' | 'DT' | 'AA';

  const isHeatingKey = (key: string): key is HeatingKey => {
    return ['HT', 'DT', 'AA'].includes(key);
  };

  const handleToggle = useCallback(async (key: HeatingKey) => {
    try {
      // Toggle the switch state immediately for better UX
      setDisplayData(prevData => ({
        ...prevData,
        [key]: {
          ...prevData[key],
          strValue: prevData[key].strValue === 'Ein' ? 'Aus' : 'Ein'
        }
      }));

      // Delay the API call slightly to prevent rapid toggling
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Make the API call
      await loadAndStoreEta();
      
    } catch (error) {
      console.warn(`Error toggling ${key}:`, error);
    }
  }, [loadAndStoreEta]);

  if (loadingState.isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
                            handleButtonClick(key as HeatingKey);
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
