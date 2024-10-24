'use client';

import { useDataReadAndStore } from '@/functions/DataReader';
import { RootState } from '../redux';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';
import { env } from 'process';

const defaultConfigFile = env.DEFAULT_CONFIG_FILE || '../config/f_etacfg.json';

const Data: React.FC = () => {
    const  loadAndStoreData  = useDataReadAndStore(defaultConfigFile);

    const data = useSelector((state: RootState) => state.data);
    const error = useSelector((state: any) => state.data.error);
    const isLoading = useSelector((state: any) => state.data.isLoading);

    useEffect(() => {
        loadAndStoreData();
    }, [loadAndStoreData]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }
    return (
        <div>
            <h1>Data:</h1>
            <pre>{JSON.stringify(data.data, null, 2)}</pre>
            <pre>{JSON.stringify(data.loadingState.error, null, 2)}</pre>
        </div>
    );
}

export default Data;

