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

const BackgroundSync: React.FC = () => {
  const dispatch = useDispatch();
  const config = useSelector((state: RootState) => state.config);
  const lastConfigRef = useRef(config.data);
  const isFirstMount = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBackgroundData = useCallback(async () => {
    try {
      const response = await fetch('/api/background/status');
      const result = await response.json();
      
      if (result.success) {
        // Only update config if it has changed
        if (JSON.stringify(result.data.config) !== JSON.stringify(lastConfigRef.current)) {
          dispatch(storeConfigData(result.data.config));
          lastConfigRef.current = result.data.config;
        }
        
        // Always update other data
        dispatch(storeEtaData(result.data.eta));
        dispatch(storeWifiAf83Data(result.data.wifiAf83));
        dispatch(storeNames2IdData(result.data.names2Id));
      }
    } catch (error) {
      console.error('Error fetching background data:', error);
    }
  }, [dispatch, lastConfigRef]);

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
      };
    }
  }, [config.data, fetchBackgroundData]); // Empty dependency array since we only want this to run once on mount

  // Handle timer updates
  useEffect(() => {
    if (!isFirstMount.current && intervalRef.current) {
      const updateTimer = Math.max(
        parseInt(config.data[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER,
        MIN_API_INTERVAL
      );

      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchBackgroundData, updateTimer);
    }
  }, [fetchBackgroundData, dispatch, config.data]);

  return null; // This component doesn't render anything
};

export default BackgroundSync;
