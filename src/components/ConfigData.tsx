import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useConfigReadAndStore } from '../functions/Config';
import { RootState } from '../redux'
import { env } from 'process';

const defaultConfigFile = env.DEFAULT_CONFIG_FILE || '../config/f_etacfg.json';

const ConfigData: React.FC = async () => {
    const loadAndStoreConfig  = useConfigReadAndStore(defaultConfigFile);
    const config = useSelector((state: RootState) => state.config);

    useEffect(() => {
        loadAndStoreConfig();
    }, [loadAndStoreConfig]);

    return (
        <div>
            <h1>Konfiguration:</h1>
            <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
    );
}

export default ConfigData;
