'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { storeData as storeWifiAf83Data } from '@/redux/wifiAf83Slice';
import { storeData as storeNames2IdData } from '@/redux/names2IdSlice';
import { RootState } from '@/redux';
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';
import { API } from '@/constants/apiPaths';

const BackgroundSync: React.FC = () => {
  const dispatch = useDispatch();
  const config = useSelector((state: RootState) => state.config);
  const lastConfigRef = useRef(config.data);
  const isFirstMount = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBackgroundData = useCallback(async () => {
    try {
      // Abort any in-flight request before starting a new one
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch(API.BACKGROUND_STATUS, { signal: controller.signal });
      const result = await response.json();
      
      if (result.success) {
        // Only update config if it has changed
        if (JSON.stringify(result.data.config) !== JSON.stringify(lastConfigRef.current)) {
          dispatch(storeConfigData(result.data.config));
          lastConfigRef.current = result.data.config;
        }
        
        // Always update other data - but only if we actually have data
        if (result.data.eta && Object.keys(result.data.eta).length > 0) {
          dispatch(storeEtaData(result.data.eta));
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
      }
    } catch (error) {
      // Ignore aborted fetches
      if ((error as any)?.name === 'AbortError') return;
      console.error('Error fetching background data:', error);
    } finally {
      // Clear reference after request completes
      if (abortRef.current) {
        abortRef.current = null;
      }
    }
  }, [dispatch]);

  useEffect(() => {
    // Only set up the interval if this is the first mount
    if (isFirstMount.current) {
      isFirstMount.current = false;

      // Calculate update interval from config, ensuring it's not less than MIN_API_INTERVAL
      const updateTimer = Math.max(
        parseInt(config.data[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER,
        MIN_API_INTERVAL
      );

      // Fetch immediately
      fetchBackgroundData();

      // Then fetch periodically
      intervalRef.current = setInterval(fetchBackgroundData, updateTimer);

      // Cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        // Abort any in-flight request on unmount
        if (abortRef.current) {
          abortRef.current.abort();
          abortRef.current = null;
        }
      };
    }
  }, [fetchBackgroundData]); // Only depend on fetchBackgroundData, not config.data

  // Handle timer updates - only when timer value actually changes
  const updateTimerValue = Math.max(
    parseInt(config.data[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER,
    MIN_API_INTERVAL
  );
  const lastTimerRef = useRef(updateTimerValue);

  useEffect(() => {
    if (!isFirstMount.current && intervalRef.current && lastTimerRef.current !== updateTimerValue) {
      console.log(`Timer changed from ${lastTimerRef.current}ms to ${updateTimerValue}ms, restarting interval...`);
      lastTimerRef.current = updateTimerValue;

      clearInterval(intervalRef.current);
      // Abort any in-flight request when resetting
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      intervalRef.current = setInterval(fetchBackgroundData, updateTimerValue);
      // Trigger an immediate fetch after resetting to avoid waiting a full interval
      fetchBackgroundData();
    }
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
