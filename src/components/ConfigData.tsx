'use client'

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError, setIsLoading } from '@/redux/configSlice';

const ConfigData: React.FC = () => {
    const dispatch: AppDispatch = useAppDispatch();
    const config = useSelector((state: RootState) => state.config);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        const loadConfigData = async () => {
            dispatch(setIsLoading(true)); // Start loading
            try {
                const response = await fetch('/api/config/config');
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

    const handleEdit = (value: string) => {
        setEditValue(value);
        setIsEditing(true);
    };

    const handleSave = async () => {
        try {
            const response = await fetch('/api/config/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: ConfigKeys.T_SOLL,
                    value: editValue.trim()
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update config');
            }

            const updatedConfig = await response.json();
            dispatch(storeData(updatedConfig));
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating config:', error);
            alert('Failed to update config. Please try again.');
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue('');
    };

    return (
        <div className="flex flex-col items-start">
            <h1 className='text-2xl py-5'>Konfiguration:</h1>
            <table className="border-collapse border border-gray-300 w-[400px]">
               <tbody>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Solltemperatur</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">
                            {isEditing ? (
                                <div className="flex flex-col items-end space-y-2">
                                    <div className="flex items-center justify-end space-x-2">
                                        <input
                                            type="range"
                                            min="10"
                                            max="25"
                                            step="0.5"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-24"
                                        />
                                        <span className="w-12 text-right font-mono">
                                            {editValue}°C
                                        </span>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={handleSave}
                                            className="text-green-600 text-sm hover:text-green-800"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            onClick={handleCancel}
                                            className="text-red-600 text-sm hover:text-red-800"
                                        >
                                            ✗
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    className="cursor-pointer hover:text-blue-600 font-mono"
                                    onClick={() => handleEdit(config.data[ConfigKeys.T_SOLL]?.replace('*', '') || '')}
                                >
                                    {config.data[ConfigKeys.T_SOLL]?.replace('*', '') || ''}°C
                                </div>
                            )}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Deltatemperatur</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.T_DELTA]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Updates</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.T_UPDATE_TIMER]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Eta Server</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.S_ETA]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">ETA Konfiguration</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.F_ETA]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">WIFIAF83 Konfiguration</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.F_WIFIAF83]?.replace('*', '') || ''}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">NAMES2ID Konfiguration</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">{config.data[ConfigKeys.F_NAMES2ID]?.replace('*', '') || ''}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default ConfigData;
