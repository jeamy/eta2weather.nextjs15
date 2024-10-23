import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useConfigReader } from '../functions/Config';
import { RootState } from '../redux'
const fconfig = '../config/f_etacfg.json';

const ConfigData: React.FC = async () => {
    const { loadConfig } = useConfigReader(fconfig);
    const config = useSelector((state: RootState) => state.config);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    return (
        <div>
            <h1>Konfiguration:</h1>
            <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
    );
}

export default ConfigData;
