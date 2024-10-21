import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { useEtaReader } from '../functions/FetchEta';
import { useConfigReader } from '@/functions/Config';

const EtaData: React.FC = () => {
  const etaData = useSelector((state: RootState) => state.eta);
  const { loadEtaData } = useEtaReader('path/to/config.json');

  useEffect(() => {
      loadEtaData();
  }, []);


  return (
    <div>
      <h2>ETA-Daten:</h2>
      <pre>{JSON.stringify(etaData, null, 2)}</pre>
    </div>
  );
};

export default EtaData;



