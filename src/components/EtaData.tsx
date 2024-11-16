'use client'

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData, storeError } from '@/redux/etaSlice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { EtaData as EtaDataType, ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';

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
  const [displayData, setDisplayData] = useState<Record<string, DisplayEtaValue> | null>(null);

  useEffect(() => {
    const loadAndStoreEta = async () => {
      try {
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
      }
    };

    // Initial load
    loadAndStoreEta();

    // Set up interval for periodic updates
    const interval = setInterval(loadAndStoreEta, parseInt(config.data.t_update_timer) || 60000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [dispatch, config.data.t_update_timer]);

  if (!displayData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col items-start">
      <h1 className="text-2xl py-5">ETA-Daten:</h1>
      <table className="border-collapse w-[400px]">
        <tbody>
          {Object.entries(displayData)
            .filter(([_, value]) => value.strValue && value.strValue.trim() !== '')
            .sort(([_, a], [__, b]) => {
              const order: Record<string, number> = { SP: 1, AT: 2, KZ: 3, VT: 4, HK: 5, IP: 6, VR: 7, SZ: 8, EAT: 9, HT: 10, KT: 11 };
              const aOrder = a.short in order ? order[a.short] : 99;
              const bOrder = b.short in order ? order[b.short] : 99;
              return aOrder - bOrder;
            })
            .map(([key, value]) => (
              <tr key={key} className="border border-gray-200">
                <td className="px-4 py-2 flex justify-between">
                  <div className="w-[250px]">
                    <span className="font-mono">{value.short}</span>
                    <span className="mx-2">|</span>
                    <span>{value.long}: </span>
                  </div>
                  <div className="w-[150px] text-right">
                    <span className="font-semibold font-mono">{value.strValue}</span>
                    <span className="ml-1 text-gray-600">{value.unit}</span>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default EtaData;
