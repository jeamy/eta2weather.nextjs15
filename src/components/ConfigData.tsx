
'use client'

import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux'
import { ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';

const ConfigData: React.FC = () => {
    const config = useSelector((state: RootState) => state.config);

    if(config.loadingState.isLoading) {
        return <div>Loading...</div>;
    }

    if(config.loadingState.error) {
        return <div>Error: {config.loadingState.error}</div>;
    }

    return (
        <div>
            <h1>Konfiguration:</h1>
            <pre>{JSON.stringify(config.data[ConfigKeys.T_SOLL], null, 2)}</pre>
            <pre>{JSON.stringify(config.data[ConfigKeys.T_DELTA], null, 2)}</pre>
            <pre>{JSON.stringify(config.data[ConfigKeys.T_UPDATE_TIMER], null, 2)}</pre>
            <pre>{JSON.stringify(config.data[ConfigKeys.S_ETA], null, 2)}</pre>
            <pre>{JSON.stringify(config.data[ConfigKeys.F_ETA], null, 2)}</pre>
            <pre>{JSON.stringify(config.data[ConfigKeys.F_WIFIAF83], null, 2)}</pre>
            <pre>{JSON.stringify(config.data[ConfigKeys.F_NAMES2ID], null, 2)}</pre>

        </div>
    );
}

export default ConfigData;
