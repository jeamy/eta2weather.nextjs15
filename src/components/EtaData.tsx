'use client'

import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { useEtaReadAndStore } from '../reader/functions/FetchEta';
import { ConfigState } from '@/redux/configSlice';
import { Names2IdState } from '@/redux/names2IdSlice';
const EtaData: React.FC = () => {
  const config: ConfigState = useSelector((state: RootState) => state.config);
  const names2id: Names2IdState = useSelector((state: RootState) => state.names2Id);

  const loadAndStoreEta = useEtaReadAndStore(config.data, names2id.data);

  useEffect(() => {
    loadAndStoreEta();
  }, [loadAndStoreEta]);

  return (
    <div>
      <h2>ETA-Daten:</h2>
      <pre>{JSON.stringify(loadAndStoreEta, null, 2)}</pre>
    </div>
  );
};

export default EtaData;



