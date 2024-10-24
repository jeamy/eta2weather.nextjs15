'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { useEffect } from 'react';
import { ConfigState } from '@/redux/configSlice';
import { useWifiReadAndStore } from '@/reader/functions/FetchWifiAf83';

const WifiAf83Data: React.FC = () => {
  const config: ConfigState = useSelector((state: RootState) => state.config);

  const loadAndStoreWifi = useWifiReadAndStore(config.data);

  useEffect(() => {
    loadAndStoreWifi();
  }, [loadAndStoreWifi]);

  return (
    <div>
      <h2>Wifi-Daten:</h2>
      <pre>{JSON.stringify(loadAndStoreWifi, null, 2)}</pre>
    </div>
  );
};

export default WifiAf83Data;