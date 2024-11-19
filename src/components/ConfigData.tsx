'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { useAppDispatch } from '../redux/hooks';
import { storeData as storeEtaData } from '../redux/etaSlice';
import { AppDispatch } from '@/redux/index';
import { storeData, storeError, setIsLoading as setIsConfigLoading } from '@/redux/configSlice';
import { EtaConstants, defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import { updateSliderPosition } from '@/utils/Functions';
import { EtaApi } from '@/reader/functions/EtaApi';
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';

const ConfigData: React.FC = () => {
    const dispatch: AppDispatch = useAppDispatch();
    const config = useSelector((state: RootState) => state.config);
    const etaState = useSelector((state: RootState) => state.eta);
    const [isEditing, setIsEditing] = useState<ConfigKeys | null>(null);
    const [editValue, setEditValue] = useState('');
    const sliderValue = config.data[ConfigKeys.T_SLIDER];
    const etaApiRef = useRef<EtaApi | null>(null);
    const lastSliderUpdate = useRef<string | null>(null);

    useEffect(() => {
        // Only load config if not already initialized
        if (!config.isInitialized) {
            const loadConfigData = async () => {
                if (!config.loadingState.isLoading) {  // Prevent multiple simultaneous loads
                    dispatch(setIsConfigLoading(true));
                    try {
                        const response = await fetch('/api/config/read');
                        if (!response.ok) {
                            throw new Error('Failed to fetch config');
                        }
                        const data = await response.json();
                        dispatch(storeData(data));
                    } catch (error) {
                        const typedError = error as Error;
                        console.error('Error fetching config data:', typedError);
                        dispatch(storeError(typedError.message));
                    } finally {
                        dispatch(setIsConfigLoading(false)); // End loading
                    }
                }
            };
            loadConfigData();
        }
    }, [config.isInitialized, config.loadingState.isLoading, dispatch]);

    useEffect(() => {
        if (config.data[ConfigKeys.S_ETA]) {
            etaApiRef.current = new EtaApi(config.data[ConfigKeys.S_ETA]);
        }
    }, [config.data]);

    const etaSliderPosition = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id]?.strValue;

    useEffect(() => {
        const recommendedPos = Math.round(parseFloat(sliderValue || '0'));
        const etaSP = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
        const currentPos = etaSP ? parseFloat(etaSP.strValue) : recommendedPos;

        // Only update if the positions are different, values are valid, and it's not the same update
        if (etaSP && 
            recommendedPos !== currentPos && 
            !isNaN(recommendedPos) && 
            !isNaN(currentPos) &&
            lastSliderUpdate.current !== sliderValue) {
            
            lastSliderUpdate.current = sliderValue;
            
            if (!etaApiRef.current) {
                console.error('EtaApi not initialized');
                return;
            }
            updateSliderPosition(
                recommendedPos,
                currentPos,
                defaultNames2Id,
                etaApiRef.current,
            ).then(result => {
                if (result.success) {
                    // Update the SP value in the Redux store immediately
                    const updatedEtaData = { ...etaState.data };
                    const spId = defaultNames2Id[EtaConstants.SCHIEBERPOS].id;
                    if (updatedEtaData[spId]) {
                        updatedEtaData[spId] = {
                            ...updatedEtaData[spId],
                            strValue: (result.position).toString()
                        };
                        dispatch(storeEtaData(updatedEtaData));
                    }
                }
            }).catch(error => {
                console.error('Error updating slider position:', error);
            });
        }
    }, [sliderValue, etaState.data, dispatch]);

    if (config.loadingState.isLoading) {
        return <div>Loading...</div>;
    }

    if (config.loadingState.error) {
        return <div>Error: {config.loadingState.error}</div>;
    }

    const convertMsToMinutes = (ms: string): string => {
        return (parseInt(ms) / 60000).toString();
    };

    const convertMinutesToMs = (minutes: string): string => {
        return (parseFloat(minutes) * 60000).toString();
    };

    const handleCancel = () => {
        setIsEditing(null);
        setEditValue('');
    };

    const validateIpWithPort = (value: string): boolean => {
        // Split IP and port
        const [ip, port] = value.split(':');
        
        // Validate IP
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) return false;
        
        // Check IP octets
        const octets = ip.split('.');
        for (const octet of octets) {
            const num = parseInt(octet);
            if (num < 0 || num > 255) return false;
        }
        
        // Validate port if present
        if (port !== undefined) {
            const portNum = parseInt(port);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) return false;
        }
        
        return true;
    };

    const renderEditableValue = (
        key: ConfigKeys, 
        label: string, 
        min: number, 
        max: number, 
        step: number, 
        unit: string,
        valueConverter?: {
            fromStorage: (value: string) => string;
            toStorage: (value: string) => string;
        }
    ) => {
        const isEditingThis = isEditing === key;
        const configValue = config.data[key] || '';
        const rawValue = typeof configValue === 'string' ? configValue.replace('*', '') : '';
        const value = valueConverter ? valueConverter.fromStorage(rawValue) : rawValue;

        const handleEditStart = () => {
            setEditValue(value);
            setIsEditing(key);
        };

        const handleSaveValue = async () => {
            if (!isEditing) return;
            
            try {
                const valueToSave = valueConverter ? valueConverter.toStorage(editValue) : editValue;
                const response = await fetch('/api/config/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: isEditing,
                        value: valueToSave.trim()
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update config');
                }

                const updatedConfig = await response.json();
                dispatch(storeData(updatedConfig));
                setIsEditing(null);
            } catch (error) {
                console.error('Error updating config:', error);
                alert('Failed to update config. Please try again.');
            }
        };

        return (
            <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">
                {isEditingThis ? (
                    <div className="flex flex-col items-end space-y-2">
                        <div className="flex items-center justify-end space-x-2">
                            <input
                                type="range"
                                min={min}
                                max={max}
                                step={step}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-24"
                            />
                            <span className="w-16 text-right font-mono">
                                {editValue}{unit}
                            </span>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="text-red-600 text-sm hover:text-red-800"
                                aria-label="Save changes"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="text-green-600 text-sm hover:text-green-800"
                                aria-label="Cancel changes"
                            >
                                ✗
                            </button>
                        </div>
                    </div>
                ) : (
                    <div 
                        className="cursor-pointer hover:text-blue-600 font-mono group relative"
                        onClick={() => handleEditStart()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleEditStart();
                            }
                        }}
                    >
                        {value}{unit}
                        <span className="invisible group-hover:visible absolute -top-8 right-0 bg-gray-800 text-white text-sm py-1 px-2 rounded whitespace-nowrap">
                            {label} ändern
                        </span>
                    </div>
                )}
            </td>
        );
    };

    const renderEditableText = (key: ConfigKeys, label: string, validator?: (value: string) => boolean) => {
        const isEditingThis = isEditing === key;
        const configValue = config.data[key] || '';
        const value = typeof configValue === 'string' ? configValue.replace('*', '') : '';

        const handleEditStart = () => {
            setEditValue(value);
            setIsEditing(key);
        };

        const handleSaveValue = async () => {
            if (!isEditing) return;
            
            if (validator && !validator(editValue)) {
                alert('Ungültige IP-Adresse. Format: xxx.xxx.xxx.xxx oder xxx.xxx.xxx.xxx:port');
                return;
            }

            try {
                const response = await fetch('/api/config/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: isEditing,
                        value: editValue.trim()
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update config');
                }

                const updatedConfig = await response.json();
                dispatch(storeData(updatedConfig));
                setIsEditing(null);
            } catch (error) {
                console.error('Error updating config:', error);
                alert('Failed to update config. Please try again.');
            }
        };

        return (
            <td className="border border-gray-300 px-4 py-2 text-right w-[150px]">
                {isEditingThis ? (
                    <div className="flex flex-col items-end space-y-2">
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className={`w-full px-2 py-1 text-right border rounded ${
                                validator && !validator(editValue) ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="xxx.xxx.xxx.xxx:port"
                        />
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="text-red-600 text-sm hover:text-red-800"
                                aria-label="Save changes"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="text-blue-600 text-sm hover:text-blue-800"
                                aria-label="Cancel changes"
                            >
                                ✗
                            </button>
                        </div>
                    </div>
                ) : (
                    <div 
                        className="cursor-pointer hover:text-blue-600 font-mono group relative"
                        onClick={handleEditStart}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleEditStart();
                            }
                        }}
                    >
                        {value}
                        <span className="invisible group-hover:visible absolute -top-8 right-0 bg-gray-800 text-white text-sm py-1 px-2 rounded whitespace-nowrap">
                            {label} ändern
                        </span>
                    </div>
                )}
            </td>
        );
    };

    return (
        <div className="flex flex-col items-start">
            <h1 className='text-2xl py-5'>Konfiguration:</h1>
            <table className="border-collapse border border-gray-300 w-[400px]">
               <tbody>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Solltemperatur</td>
                        {renderEditableValue(ConfigKeys.T_SOLL, 'Solltemperatur', 10, 25, 0.5, '°C')}
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Deltatemperatur</td>
                        {renderEditableValue(ConfigKeys.T_DELTA, 'Deltatemperatur', -5, 5, 0.5, '°C')}
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Updates</td>
                        {renderEditableValue(
                            ConfigKeys.T_UPDATE_TIMER,
                            'Updates',
                            0,
                            10,
                            0.5,
                            ' min',
                            {
                                fromStorage: convertMsToMinutes,
                                toStorage: convertMinutesToMs
                            }
                        )}
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Empfohlene Schieber Position</td>
                        <td className="border border-gray-300 px-4 py-2 text-right w-[150px] font-mono">
                            {(() => {
                                const recommendedPos = Math.round(parseFloat(sliderValue || '0'));
                                const etaSP = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
                                const currentPos = etaSP ? parseFloat(etaSP.strValue) : recommendedPos;
                                
                                const colorClass = recommendedPos > currentPos 
                                    ? 'text-green-600' 
                                    : recommendedPos < currentPos 
                                        ? 'text-red-600' 
                                        : 'text-gray-900';
                                
                                return (
                                    <>
                                        <span className={`font-bold ${colorClass}`}>
                                            {recommendedPos}
                                        </span>
                                        <span className="ml-1 text-gray-600">%</span>
                                    </>
                                );
                            })()}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2 w-[250px]">Eta Server</td>
                        {renderEditableText(ConfigKeys.S_ETA, 'Eta Server', validateIpWithPort)}
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
