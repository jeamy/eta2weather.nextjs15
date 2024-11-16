'use client'

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError } from '@/redux/etaSlice';
import { EtaData as EtaDataType } from '@/reader/functions/types-constants/EtaConstants';

interface DisplayEtaValue {
  short: string;
  long: string;
  strValue: string;
  unit: string;
}

const EtaData: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config: ConfigState = useSelector((state: RootState) => state.config);
  const [displayData, setDisplayData] = useState<Record<string, DisplayEtaValue> | null>(null);

  useEffect(() => {
    const loadAndStoreEta = async () => {
      try {
        const response = await fetch('/api/eta');
        const data: Record<string, any> = await response.json();
        
        // Transform the data for display
        const transformed = Object.entries(data).reduce((acc, [key, value]) => {
          acc[key] = {
            short: value.short || '',
            long: value.long || '',
            strValue: value.strValue || '',
            unit: value.unit || ''
          };
          return acc;
        }, {} as Record<string, DisplayEtaValue>);
        
        setDisplayData(transformed);
        dispatch(storeData(data));
      } catch (error) {
        const typedError = error as Error;
        console.error('Error fetching ETA data:', typedError);
        dispatch(storeError(typedError.message));        
      }
    };
    loadAndStoreEta();
  }, [dispatch]);

  return (
    <div className="flex flex-col items-start">
      <h1 className='text-2xl py-5'>ETA-Daten:</h1>
      {displayData ? (
        <table className="border-collapse w-[400px]">
          <tbody>
            {Object.entries(displayData)
              .filter(([_, value]) => value.strValue && value.strValue.trim() !== '')
              .sort(([_, a], [__, b]) => {
                const order: Record<string, number> = { SP: 1, AT: 2, KZ: 3, VT: 4, HK: 5 };
                const aOrder = a.short in order ? order[a.short] : 99;
                const bOrder = b.short in order ? order[b.short] : 99;
                return aOrder - bOrder;
              })
              .map(([key, value]) => (
              <tr key={key} className="border border-gray-200">
                <td className="px-4 py-2 flex justify-between">
                  <div className="w-[250px]">
                    <span className="font-mono">{value.short}</span>
                    <span className="mx-2">:</span>
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
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default EtaData;
