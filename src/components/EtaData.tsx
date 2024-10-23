import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux';
import { useEtaReader } from '../functions/FetchEta';
import { Names2IdReader } from '../functions/Names2Id';
import { ConfigKeys, ConfigReader } from '../functions/Config';
import { Names2IdType } from '../functions/Names2Id';
const EtaData: React.FC = async () => {
    // const configReader = new ConfigReader(ConfigKeys.F_ETA);
    // const config = await configReader.readConfig();
    const config = useSelector((state: RootState) => state.config);
    // const names2id = new Names2IdReader(config).readNames2Id();
    const names2id: Names2IdType = useSelector((state: RootState) => state.names2Id);

  const loadEta = useEtaReader(config, names2id);

  useEffect(() => {
      loadEta();
  }, [loadEta]);

  return (
    <div>
      <h2>ETA-Daten:</h2>
      <pre>{JSON.stringify(loadEta, null, 2)}</pre>
    </div>
  );
};

export default EtaData;



