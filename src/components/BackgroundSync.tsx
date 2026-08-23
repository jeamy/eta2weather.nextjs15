'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { storeData as storeWifiAf83Data } from '@/redux/wifiAf83Slice';
import { storeData as storeNames2IdData } from '@/redux/names2IdSlice';
import { storeData as storeControlData } from '@/redux/controlSlice';
import { RootState } from '@/redux';
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import { API } from '@/constants/apiPaths';

const BackgroundSync: React.FC = () => {
  const dispatch = useDispatch();
  const config = useSelector((state: RootState) => state.config);
  const lastConfigRef = useRef(config.data);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBackgroundData = useCallback(async () => {
    let controller: AbortController | null = null;
    try {
      // Abort any in-flight request before starting a new one
      if (abortRef.current) {
        abortRef.current.abort();
      }
      controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch(API.BACKGROUND_STATUS, { signal: controller.signal });
      const result = await response.json();
      
      if (result.success) {
        const hasEtaData = result.data.eta && Object.keys(result.data.eta).length > 0;
        // Only update config if it has changed
        if (JSON.stringify(result.data.config) !== JSON.stringify(lastConfigRef.current)) {
          dispatch(storeConfigData(result.data.config));
          lastConfigRef.current = result.data.config;
        }
        
        // Always update other data - but only if we actually have data
        if (hasEtaData) {
          dispatch(storeEtaData(result.data.eta));
        } else {
          const etaResponse = await fetch(API.ETA_READ, { signal: controller.signal });
          const etaResult = await etaResponse.json();
          if (etaResult.success && etaResult.data && Object.keys(etaResult.data).length > 0) {
            dispatch(storeEtaData(etaResult.data));
          } else if (!retryTimeoutRef.current) {
            retryTimeoutRef.current = setTimeout(() => {
              retryTimeoutRef.current = null;
              fetchBackgroundData();
            }, 2000);
          }
        }
        
        // Only update WiFi data if it exists (API sends undefined if not initialized)
        if (result.data.wifiAf83) {
          const wifiData = result.data.wifiAf83;
          // Double-check validity (should already be valid from API)
          if (wifiData.time > 0 && (wifiData.temperature !== undefined || wifiData.indoorTemperature !== undefined)) {
            dispatch(storeWifiAf83Data(wifiData));
          } else {
            console.warn('Received invalid WiFi data structure, skipping update:', wifiData);
          }
        }
        if (result.data.names2Id) {
          dispatch(storeNames2IdData(result.data.names2Id));
        }
        if (result.data.control) {
          dispatch(storeControlData({
            manualOverride: Boolean(result.data.control.manualOverride),
            manualOverrideTime: result.data.control.manualOverrideTime ?? null,
          }));
        }
      }
    } catch (error) {
      // Ignore aborted fetches
      if ((error as any)?.name === 'AbortError') return;
      console.error('Error fetching background data:', error);
    } finally {
      // Clear reference after request completes
      if (controller && abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [dispatch]);

  const updateTimerValue = Math.max(
    parseInt(config.data[ConfigKeys.T_UPDATE_TIMER], 10) || DEFAULT_UPDATE_TIMER,
    MIN_API_INTERVAL
  );

  useEffect(() => {
    void fetchBackgroundData();
    intervalRef.current = setInterval(fetchBackgroundData, updateTimerValue);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [updateTimerValue, fetchBackgroundData]);

  // Refresh immediately when tab becomes visible, window gains focus, or connection returns
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing data...');
        fetchBackgroundData();
      }
    };
    const onFocus = () => {
      console.log('Window gained focus, refreshing data...');
      fetchBackgroundData();
    };
    const onOnline = () => {
      console.log('Connection restored, refreshing data...');
      fetchBackgroundData();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [fetchBackgroundData]);

  return null; // This component doesn't render anything
};

export default BackgroundSync;
