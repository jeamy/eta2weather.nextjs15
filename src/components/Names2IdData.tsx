'use client'

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { ConfigState } from '@/redux/configSlice';
import { AppDispatch } from '@/redux/index';
import { useAppDispatch } from '@/redux/hooks';
import { storeData, storeError } from '@/redux/names2IdSlice';

const Names2IdData: React.FC = () => {
  const dispatch: AppDispatch = useAppDispatch();
  const config: ConfigState = useSelector((state: RootState) => state.config);
  const [names2IdData, setNames2IdData] = useState<any>(null);

  useEffect(() => {
    const loadAndStoreNames2Id = async () => {
      try {
        const response = await fetch('/api/names2id/read');
        const data = await response.json();
        setNames2IdData(data);
        dispatch(storeData(data));
      } catch (error) {
        const typedError = error as Error; // Assert error as Error type
        console.error('Error fetching Names2Id data:', typedError);
        dispatch(storeError(typedError.message));        
      }
    };
    loadAndStoreNames2Id();
  }, [dispatch]);

  return (
    <div>
      <h1>Names2Id:</h1>
      {names2IdData ? <pre>{JSON.stringify(names2IdData, null, 2)}</pre> : <p>Loading...</p>}
    </div>
  );
};

export default Names2IdData;
