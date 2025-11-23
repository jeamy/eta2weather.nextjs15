'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '@/redux/hooks';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { API } from '@/constants/apiPaths';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { EtaData as EtaDataType } from '@/reader/functions/types-constants/EtaConstants';
import { ConfigState } from '@/redux/configSlice';

interface ApiResponse {
    success: boolean;
    data: EtaDataType;
    config?: ConfigState['data'];
}

/**
 * Central data provider that fetches ETA data once and shares it via Redux.
 * This prevents duplicate API calls from multiple components.
 */
export const EtaDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const dispatch = useAppDispatch();
    const config = useSelector((state: RootState) => state.config.data);
    const lastApiCall = useRef<number>(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstLoad = useRef(true);

    const fetchEtaData = useCallback(async (force: boolean = false) => {
        const now = Date.now();

        // Rate limiting
        if (!force && now - lastApiCall.current < MIN_API_INTERVAL) {
            console.log('[EtaDataProvider] Skipping fetch - too frequent');
            return;
        }

        try {
            lastApiCall.current = now;

            const response = await fetch(API.ETA_READ, {
                method: 'GET',
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ETA data: ${response.statusText}`);
            }

            const result: ApiResponse = await response.json();

            if (result.success && result.data) {
                // Update Redux store with fresh data
                dispatch(storeEtaData(result.data));

                // Update config if provided
                if (result.config) {
                    dispatch(storeConfigData(result.config));
                }
            }
        } catch (error) {
            console.error('[EtaDataProvider] Error fetching ETA data:', error);
        }
    }, [dispatch]);

    // Initial load
    useEffect(() => {
        if (isFirstLoad.current) {
            fetchEtaData(true);
            isFirstLoad.current = false;
        }
    }, [fetchEtaData]);

    // Setup periodic refresh
    useEffect(() => {
        const updateTimer = Math.max(
            parseInt(config.t_update_timer) || DEFAULT_UPDATE_TIMER,
            MIN_API_INTERVAL
        );

        // Clear existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Set new interval
        intervalRef.current = setInterval(() => {
            fetchEtaData(false);
        }, updateTimer);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [config.t_update_timer, fetchEtaData]);

    // Handle visibility change (refresh when tab becomes visible)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[EtaDataProvider] Page became visible, refreshing data');
                fetchEtaData(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [fetchEtaData]);

    return <>{children}</>;
};
