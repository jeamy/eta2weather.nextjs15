'use client'

import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError, setIsLoading } from '@/redux/configSlice';

const ConfigData: React.FC = () => {
    const dispatch: AppDispatch = useAppDispatch();
    const config = useSelector((state: RootState) => state.config);

    useEffect(() => {
        const loadConfigData = async () => {
            dispatch(setIsLoading(true)); // Start loading
            try {
                const response = await fetch('/api/config');
                const data = await response.json();
                dispatch(storeData(data));
            } catch (error) {
                const typedError = error as Error; // Assert error as Error type
                console.error('Error fetching config data:', typedError);
                dispatch(storeError(typedError.message));
            } finally {
                dispatch(setIsLoading(false)); // End loading
            }
        };
        loadConfigData();
    }, [dispatch]);

    if(config.loadingState.isLoading) {
        return <div>Loading...</div>;
    }

    if(config.loadingState.error) {
        return <div>Error: {config.loadingState.error}</div>;
    }

    
    return (
        <div className="flex flex-col items-start">
            <h1 className='text-2xl py-5'>Konfiguration:</h1>
            <table className="border-collapse border border-gray-300 w-[400px]">
               <tbody>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">T_SOLL</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.T_SOLL]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">T_DELTA</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.T_DELTA]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">T_UPDATE_TIMER</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.T_UPDATE_TIMER]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">S_ETA</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.S_ETA]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">F_ETA</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.F_ETA]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">F_WIFIAF83</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.F_WIFIAF83]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">F_NAMES2ID</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.F_NAMES2ID]?.replace('*', '') || ''}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default ConfigData;
