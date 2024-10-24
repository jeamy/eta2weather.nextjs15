
'use client'

import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux'

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
            <pre>{JSON.stringify(config.data, null, 2)}</pre>
        </div>
    );
}

export default ConfigData;
