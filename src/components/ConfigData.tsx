import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useConfigReader } from '../functions/Config';
import { RootState } from '../redux/store';

function ConfigData() {
    const { loadConfig } = useConfigReader('path/to/config.json');
    const config = useSelector((state: RootState) => state.config);

    useEffect(() => {
        loadConfig();
    }, []);

    return (
        <div>
            <h1>Konfiguration:</h1>
            <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
    );
}

export default ConfigData;
