import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { useEffect } from 'react';

const WifiAf83Data: React.FC = () => {
  const wifiAF83Data = useSelector((state: RootState) => state.wifiAF83.data);
  const loadWifi = useWifiAf83Reader();

  useEffect(() => {
      loadWifi();
  }, [loadWifi]);

  return (
    <div>
      <h2>ETA-Daten:</h2>
      <pre>{JSON.stringify(loadWifi, null, 2)}</pre>
    </div>
  );
};

export default WifiAf83Data;