import React, { useEffect } from 'react';
import { useLoadNames2Id } from '../functions/Names2Id';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { ConfigState } from '@/redux/configSlice';

const Names2IdData: React.FC = () => {
  const config: ConfigState = useSelector((state: RootState) => state.config);
  const loadAndStoreNames2Id = useLoadNames2Id(config.data);

  useEffect(() => {
    loadAndStoreNames2Id();
  }, [loadAndStoreNames2Id]);

  return (
    <div>
      <h1>Names2Id:</h1>
      <pre>{JSON.stringify(loadAndStoreNames2Id, null, 2)}</pre>
    </div>
  );

};

export default Names2IdData


