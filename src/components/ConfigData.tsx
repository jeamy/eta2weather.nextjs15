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
import { DEFAULT_UPDATE_TIMER } from '@/reader/functions/types-constants/TimerConstants';
import Image from 'next/image';
import { API } from '@/constants/apiPaths';

const ConfigData: React.FC = () => {
    const dispatch: AppDispatch = useAppDispatch();
    const config = useSelector((state: RootState) => state.config);
    const etaState = useSelector((state: RootState) => state.eta);
    const [isEditing, setIsEditing] = useState<ConfigKeys | null>(null);
    const [editValue, setEditValue] = useState('');
    const sliderValue = config.data[ConfigKeys.T_SLIDER];
    const etaApiRef = useRef<EtaApi | null>(null);
    const lastSliderUpdate = useRef<string | null>(null);
    const [nextUpdate, setNextUpdate] = useState<number>(0);
    const lastUpdateTime = useRef<number>(Date.now());

    useEffect(() => {
        const loadConfigData = async () => {
            try {
//                console.log('Fetching config data...');
                const response = await fetch(API.CONFIG_READ);
                const result = await response.json();
//                console.log('API Response:', result);

                if (result.success && result.data) {
                    dispatch(storeData(result.data));
                } else {
                    throw new Error(result.error || 'Failed to load config');
                }
            } catch (error) {
                console.error('Error loading config:', error);
                dispatch(storeError((error as Error).message));
            }
        };

        // Load config data when component mounts
        loadConfigData();
    }, [dispatch]);

    useEffect(() => {
//        console.log('Current config state:', config);
    }, [config]);

    useEffect(() => {
        if (config.data[ConfigKeys.S_ETA]) {
            etaApiRef.current = new EtaApi(config.data[ConfigKeys.S_ETA]);
        }
    }, [config.data]);

    useEffect(() => {
        lastUpdateTime.current = Date.now();
    }, [etaState.data]);

    const etaSliderPosition = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id]?.strValue;

    useEffect(() => {
        const recommendedPos = Math.round(parseFloat(sliderValue || '0'));
        const etaSP = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
        const currentPos = etaSP ? parseFloat(etaSP.strValue || '0') : recommendedPos;

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

    useEffect(() => {
        const updateTimer = parseInt(config.data[ConfigKeys.T_UPDATE_TIMER]) || 60000;
        let interval: NodeJS.Timeout;

        const updateCountdown = () => {
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateTime.current;
            const remainingTime = Math.max(0, Math.floor((updateTimer - timeSinceLastUpdate) / 1000));
            setNextUpdate(remainingTime);

            if (remainingTime === 0) {
                lastUpdateTime.current = now;
            }
        };

        // Update countdown immediately and start interval
        updateCountdown();
        interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [config.data]);

    if (config.loadingState.isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[200px]">
                <p>Loading...</p>
            </div>
        );
    }

    if (config.loadingState.error) {
        return (
            <div className="flex justify-center items-center min-h-[200px]">
                <p>Error: {config.loadingState.error}</p>
            </div>
        );
    }

    const convertMsToMinutes = (ms: string): string => {
        if (!ms) {
            return (DEFAULT_UPDATE_TIMER / 60000).toString();
        }
        const minutes = parseInt(ms) / 60000;
        return isNaN(minutes) ? (DEFAULT_UPDATE_TIMER / 60000).toString() : minutes.toString();
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
                const response = await fetch(API.CONFIG, {
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

                const result = await response.json();
                if (result.success && result.config) {
                    dispatch(storeData(result.config));
                    setIsEditing(null);
                } else {
                    throw new Error('Invalid response format');
                }
            } catch (error) {
                console.error('Error updating config:', error);
                alert('Failed to update config. Please try again.');
            }
        };

        return (
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="font-medium">{label}:</span>
                    {isEditingThis ? (
                        <div className="flex space-x-2">
                            <div className="flex items-center space-x-1">
                                <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveValue();
                                        }
                                    }}
                                    className="w-24 px-2 py-1 border rounded border-gray-300"
                                />
                                <span className="text-gray-500 text-sm">{unit}</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="text-green-600 hover:text-green-800 px-1"
                                title="Save"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="text-red-600 hover:text-red-800 px-1"
                                title="Cancel"
                            >
                                ✗
                            </button>
                        </div>
                    ) : (
                        <div 
                            className="cursor-pointer hover:text-blue-600 flex items-center space-x-1"
                            onClick={handleEditStart}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleEditStart();
                                }
                            }}
                        >
                            <span>{value}</span>
                            <span className="text-gray-500 text-sm">{unit}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderEditableText = (key: ConfigKeys, label: string, validator?: (value: string) => boolean) => {
        const isEditingThis = isEditing === key;
        const configValue = config.data[key] || '';
        const rawValue = typeof configValue === 'string' ? configValue.replace('*', '') : '';
        const value = rawValue;

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
                const response = await fetch(API.CONFIG, {
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

                const result = await response.json();
                if (result.success && result.config) {
                    dispatch(storeData(result.config));
                    setIsEditing(null);
                } else {
                    throw new Error('Invalid response format');
                }
            } catch (error) {
                console.error('Error updating config:', error);
                alert('Failed to update config. Please try again.');
            }
        };

        return (
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="font-medium">{label}:</span>
                    {isEditingThis ? (
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveValue();
                                    }
                                }}
                                className={`w-full px-2 py-1 border rounded ${
                                    validator && !validator(editValue) ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="xxx.xxx.xxx.xxx:port"
                            />
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="text-green-600 hover:text-green-800 px-1"
                                title="Save"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="text-red-600 hover:text-red-800 px-1"
                                title="Cancel"
                            >
                                ✗
                            </button>
                        </div>
                    ) : (
                        <div 
                            className="cursor-pointer hover:text-blue-600"
                            onClick={handleEditStart}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleEditStart();
                                }
                            }}
                        >
                            <span>{value}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderManualOverride = () => {
        const isEditingThis = isEditing === ConfigKeys.T_OVERRIDE;
        const configValue = config.data[ConfigKeys.T_OVERRIDE] || '';
        const rawValue = typeof configValue === 'string' ? configValue.replace('*', '') : '';
        const value = rawValue ? parseInt(rawValue) / 60000 : 0;

        const handleEditStart = () => {
            setEditValue(String(value));
            setIsEditing(ConfigKeys.T_OVERRIDE);
        };

        const handleSaveValue = async () => {
            if (!isEditing) return;
            
            try {
                const minutes = parseInt(editValue);
                const valueToSave = String(minutes * 60000);
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: ConfigKeys.T_OVERRIDE,
                        value: valueToSave.trim()
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update config');
                }

                const result = await response.json();
                if (result.success && result.config) {
                    dispatch(storeData(result.config));
                    setIsEditing(null);
                } else {
                    throw new Error('Invalid response format');
                }
            } catch (error) {
                console.error('Error updating config:', error);
                alert('Failed to update config. Please try again.');
            }
        };

        return (
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="font-medium">Manual override:</span>
                    {isEditingThis ? (
                        <div className="flex space-x-2">
                            <div className="flex items-center space-x-1">
                                <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveValue();
                                        }
                                    }}
                                    className="w-24 px-2 py-1 border rounded border-gray-300"
                                />
                                <span className="text-gray-500 text-sm">min</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="text-green-600 hover:text-green-800 px-1"
                                title="Save"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="text-red-600 hover:text-red-800 px-1"
                                title="Cancel"
                            >
                                ✗
                            </button>
                        </div>
                    ) : (
                        <div 
                            className="cursor-pointer hover:text-blue-600 flex items-center space-x-1"
                            onClick={handleEditStart}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleEditStart();
                                }
                            }}
                        >
                            <span>{value}</span>
                            <span className="text-gray-500 text-sm ml-1">min</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md">
            <div className="flex flex-col items-center mb-4">
                <div className="h-[150px] w-full relative flex items-center justify-center">
                    <Image
                        src="/config-logo.jpg"
                        alt="Configuration"
                        width={150}
                        height={150}
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold">Configuration</h2>
            </div>
            <div className="space-y-4 text-sm sm:text-base">
                {renderEditableValue(ConfigKeys.T_SOLL, 'Solltemperatur', 10, 25, 0.5, '°C')}
                {renderEditableValue(ConfigKeys.T_DELTA, 'Deltatemperatur', -5, 5, 0.5, '°C')}
                {renderEditableValue(ConfigKeys.T_MIN, 'Minimumtemperatur', 10, 25, 0.5, '°C')}
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
                {renderManualOverride()}
                <div className="flex justify-between items-center">
                    <span className="font-medium">Next Update:</span>
                    <span className="font-mono">{nextUpdate} s</span>
                </div>
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">Empfohlene Schieber Position:</span>
                        <span>
                            {(() => {
                                const recommendedPos = Math.round(parseFloat(sliderValue || '0'));
                                const etaSP = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
                                const currentPos = etaSP ? parseFloat(etaSP.strValue || '0') : recommendedPos;
                                
                                return (
                                    <span className={`${
                                        recommendedPos > 0 
                                            ? 'text-green-600' 
                                            : recommendedPos < 0 
                                                ? 'text-blue-600' 
                                                : ''
                                    }`}>
                                        {recommendedPos}
                                        <span className="text-gray-600 ml-1">%</span>
                                    </span>
                                );
                            })()}
                        </span>
                    </div>
                </div>
                {renderEditableText(ConfigKeys.S_ETA, 'Eta Server', validateIpWithPort)}
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">ETA Konfiguration:</span>
                        <span>{config.data[ConfigKeys.F_ETA]?.replace('*', '') || ''}</span>
                    </div>
                </div>
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">WIFIAF83 Konfiguration:</span>
                        <span>{config.data[ConfigKeys.F_WIFIAF83]?.replace('*', '') || ''}</span>
                    </div>
                </div>
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">NAMES2ID Konfiguration:</span>
                        <span>{config.data[ConfigKeys.F_NAMES2ID]?.replace('*', '') || ''}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ConfigData;
