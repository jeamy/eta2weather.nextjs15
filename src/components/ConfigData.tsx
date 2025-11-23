'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { useAppDispatch } from '../redux/hooks';
import { AppDispatch } from '@/redux/index';
import { storeData, storeError, setIsLoading as setIsConfigLoading } from '@/redux/configSlice';
import type { ConfigState } from '@/redux/configSlice';
import { EtaConstants, defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import { calculateTemperatureDiff, calculateNewSliderPosition } from '@/utils/Functions';
import { ConfigKeys, TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';
import type { Config } from '@/reader/functions/types-constants/ConfigConstants';
import { DEFAULT_UPDATE_TIMER } from '@/reader/functions/types-constants/TimerConstants';
import Image from 'next/image';
import { API } from '@/constants/apiPaths';

const ConfigData: React.FC = () => {
    const dispatch: AppDispatch = useAppDispatch();
    const config = useSelector((state: RootState) => state.config);
    const etaState = useSelector((state: RootState) => state.eta);
    const wifiState = useSelector((state: RootState) => state.wifiAf83);
    const [isEditing, setIsEditing] = useState<ConfigKeys | null>(null);
    const [editValue, setEditValue] = useState('');
    const sliderValue = config.data[ConfigKeys.T_SLIDER];
    // Removed client-side slider updates; handled by server-side BackgroundService
    const [nextUpdate, setNextUpdate] = useState<number>(0);
    const lastUpdateTime = useRef<number>(Date.now());
    // Track timeouts for cleanup
    const pendingTimeouts = useRef<Set<NodeJS.Timeout>>(new Set());

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

    // EtaApi instance no longer needed on client for slider updates

    useEffect(() => {
        lastUpdateTime.current = Date.now();
    }, [etaState.data]);

    // Client-side slider auto-update effect removed (server is source of truth)

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

        return () => {
            clearInterval(interval);
            // Cleanup all pending timeouts on unmount
            pendingTimeouts.current.forEach(clearTimeout);
            pendingTimeouts.current.clear();
        };
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
                    // Refresh config shortly after server-side recompute (file watcher debounce)
                    const timeout = setTimeout(async () => {
                        pendingTimeouts.current.delete(timeout);
                        try {
                            // Poll background status to get the latest computed config (including slider position)
                            const r = await fetch(API.BACKGROUND_STATUS);
                            const j = await r.json();
                            if (j?.success && j?.data?.config) {
                                dispatch(storeData(j.data.config));
                            } else {
                                // Fallback to reading config directly if background status fails
                                const r2 = await fetch(API.CONFIG_READ);
                                const j2 = await r2.json();
                                if (j2?.success && j2?.data) {
                                    dispatch(storeData(j2.data));
                                }
                            }
                        } catch { /* ignore */ }
                    }, 3000);
                    pendingTimeouts.current.add(timeout);
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
                            <div className="input__wrap input__wrap--number">
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
                                    className="input w-24"
                                    step={step}
                                    min={min}
                                    max={max}
                                />
                                <div className="input__spinners">
                                    <button
                                        type="button"
                                        className="input__spinner input__spinner--up"
                                        onClick={() => {
                                            const current = parseFloat(editValue) || 0;
                                            const newValue = Math.min(max, current + step);
                                            setEditValue(newValue.toString());
                                        }}
                                        tabIndex={-1}
                                    />
                                    <button
                                        type="button"
                                        className="input__spinner input__spinner--down"
                                        onClick={() => {
                                            const current = parseFloat(editValue) || 0;
                                            const newValue = Math.max(min, current - step);
                                            setEditValue(newValue.toString());
                                        }}
                                        tabIndex={-1}
                                    />
                                </div>
                                <span className="input__suffix">{unit}</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="btn btn--primary"
                                title="Save"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn btn--danger"
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
                            <span className="badge badge--neutral">{value}{unit ? <span>&nbsp;{unit}</span> : null}</span>
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
                                className={`input w-full ${validator && !validator(editValue) ? 'input--invalid' : ''}`}
                                placeholder="xxx.xxx.xxx.xxx:port"
                            />
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="btn btn--primary"
                                title="Save"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn btn--danger"
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

    const renderDeltaTemperature = () => {
        const isEditingThis = isEditing === ConfigKeys.T_DELTA;
        const deltaOverrideEnabled = config.data[ConfigKeys.DELTA_OVERRIDE] === 'true';
        const rawDelta = parseFloat(config.data[ConfigKeys.T_DELTA] || '0');

        // Display value: divided by dampening factor (unless manual override is active)
        const displayValue = deltaOverrideEnabled
            ? rawDelta.toFixed(1)
            : (rawDelta / TEMP_CALC_CONSTANTS.DELTA_DAMPENING_FACTOR).toFixed(2);

        const handleEditStart = () => {
            // When editing, show the raw value
            setEditValue(rawDelta.toString());
            setIsEditing(ConfigKeys.T_DELTA);
        };

        const handleSaveValue = async () => {
            if (!isEditing) return;

            try {
                const response = await fetch(API.CONFIG, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: ConfigKeys.T_DELTA,
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
                    // Refresh config shortly after server-side recompute
                    const timeout = setTimeout(async () => {
                        pendingTimeouts.current.delete(timeout);
                        try {
                            // Poll background status to get the latest computed config (including slider position)
                            const r = await fetch(API.BACKGROUND_STATUS);
                            const j = await r.json();
                            if (j?.success && j?.data?.config) {
                                dispatch(storeData(j.data.config));
                            } else {
                                // Fallback to reading config directly if background status fails
                                const r2 = await fetch(API.CONFIG_READ);
                                const j2 = await r2.json();
                                if (j2?.success && j2?.data) {
                                    dispatch(storeData(j2.data));
                                }
                            }
                        } catch { /* ignore */ }
                    }, 2300);
                    pendingTimeouts.current.add(timeout);
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
                    <div className="flex flex-col">
                        <span className="font-medium">Deltatemperatur:</span>
                        <span className="text-xs text-gray-500">
                            {deltaOverrideEnabled
                                ? `Roh: ${rawDelta.toFixed(1)}°C`
                                : `Roh: ${rawDelta.toFixed(1)}°C ÷ ${TEMP_CALC_CONSTANTS.DELTA_DAMPENING_FACTOR}`
                            }
                        </span>
                    </div>
                    {isEditingThis ? (
                        <div className="flex space-x-2">
                            <div className="input__wrap input__wrap--number">
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
                                    className="input w-24"
                                    step={0.5}
                                    min={-10}
                                    max={10}
                                />
                                <div className="input__spinners">
                                    <button
                                        type="button"
                                        className="input__spinner input__spinner--up"
                                        onClick={() => {
                                            const current = parseFloat(editValue) || 0;
                                            const newValue = Math.min(10, current + 0.5);
                                            setEditValue(newValue.toString());
                                        }}
                                        tabIndex={-1}
                                    />
                                    <button
                                        type="button"
                                        className="input__spinner input__spinner--down"
                                        onClick={() => {
                                            const current = parseFloat(editValue) || 0;
                                            const newValue = Math.max(-10, current - 0.5);
                                            setEditValue(newValue.toString());
                                        }}
                                        tabIndex={-1}
                                    />
                                </div>
                                <span className="input__suffix">°C</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="btn btn--primary"
                                title="Save"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn btn--danger"
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
                            <span className="badge badge--neutral">{displayValue}°C</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderDeltaOverrideToggle = () => {
        const isEnabled = config.data[ConfigKeys.DELTA_OVERRIDE] === 'true';

        const handleToggle = async () => {
            try {
                const newValue = isEnabled ? 'false' : 'true';
                const response = await fetch(API.CONFIG, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: ConfigKeys.DELTA_OVERRIDE,
                        value: newValue
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update delta override');
                }

                const result = await response.json();
                if (result.success && result.config) {
                    dispatch(storeData(result.config));
                } else {
                    throw new Error('Invalid response format');
                }
            } catch (error) {
                console.error('Error updating delta override:', error);
                alert('Failed to update delta override. Please try again.');
            }
        };

        return (
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="font-medium">Delta Override:</span>
                        <span className="text-xs text-gray-500">
                            {isEnabled ? 'Manuelle Deltatemperatur' : 'Automatische Berechnung'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`badge ${isEnabled ? 'badge--warn' : 'badge--ok'}`}>
                            {isEnabled ? 'Manuell' : 'Auto'}
                        </span>
                        <button
                            onClick={handleToggle}
                            className="switch"
                            role="switch"
                            aria-checked={isEnabled}
                            title={`Toggle Delta Override (${isEnabled ? 'Manuell' : 'Auto'})`}
                        >
                            <span className="sr-only">Toggle Delta Override</span>
                            <span className="switch__thumb" />
                        </button>
                    </div>
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
                const response = await fetch(API.CONFIG, {
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
                    // Pull server-recomputed config (diff/t_slider) shortly after file watcher debounce
                    const timeout = setTimeout(async () => {
                        pendingTimeouts.current.delete(timeout);
                        try {
                            const r = await fetch(API.BACKGROUND_STATUS);
                            const j = await r.json();
                            if (j?.success && j?.data?.config) {
                                dispatch(storeData(j.data.config));
                            }
                        } catch { /* ignore */ }
                    }, 2300);
                    pendingTimeouts.current.add(timeout);
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
                            <div className="input__wrap input__wrap--number">
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
                                    className="input w-24"
                                    step={1}
                                    min={0}
                                    max={1440}
                                />
                                <div className="input__spinners">
                                    <button
                                        type="button"
                                        className="input__spinner input__spinner--up"
                                        onClick={() => {
                                            const current = parseFloat(editValue) || 0;
                                            const newValue = Math.min(1440, current + 1);
                                            setEditValue(newValue.toString());
                                        }}
                                        tabIndex={-1}
                                    />
                                    <button
                                        type="button"
                                        className="input__spinner input__spinner--down"
                                        onClick={() => {
                                            const current = parseFloat(editValue) || 0;
                                            const newValue = Math.max(0, current - 1);
                                            setEditValue(newValue.toString());
                                        }}
                                        tabIndex={-1}
                                    />
                                </div>
                                <span className="input__suffix">min</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveValue}
                                className="btn btn--primary"
                                title="Save"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn btn--danger"
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
                            <span className="badge badge--neutral">{value} <span>min</span></span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="card">
            <div className="flex flex-col items-center mb-4 card__header">
                <div className="h-[150px] w-full relative flex items-center justify-center">
                    <Image
                        src="/config-logo.jpg"
                        alt="Configuration"
                        width={125}
                        height={125}
                        style={{ objectFit: 'contain', width: 'auto', height: 'auto' }}
                        priority
                    />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold">Configuration</h2>
            </div>
            <div className="space-y-4 text-sm sm:text-base">
                {renderEditableValue(ConfigKeys.T_SOLL, 'Solltemperatur', 10, 25, 0.5, '°C')}
                {renderDeltaOverrideToggle()}
                {renderDeltaTemperature()}
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
                    <span className="badge badge--neutral">{nextUpdate} s</span>
                </div>
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">Empfohlene Schieber Position:</span>
                        <span>
                            {(() => {
                                // Use only server-computed value from config (keine Client-Neuberechnung)
                                const recommendedPos = Math.round(parseFloat(sliderValue || '0'));
                                // Map -100 to +100 range to 0-100% width
                                const barWidth = Math.max(0, Math.min(100, (recommendedPos + 100) / 2));
                                const barColor = recommendedPos < 0 ? 'progress__bar--primary' : recommendedPos > 0 ? 'progress__bar--ok' : '';
                                return (
                                    <div className="flex flex-col items-end gap-1 w-40">
                                        <div className="progress">
                                            <div className={`progress__bar ${barColor}`} style={{ width: `${barWidth}%` }} />
                                        </div>
                                        <span>
                                            {recommendedPos}
                                            <span className="text-gray-600 ml-1">%</span>
                                        </span>
                                    </div>
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
