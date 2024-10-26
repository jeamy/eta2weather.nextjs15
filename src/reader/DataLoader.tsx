import { useAppDispatch, useAppStore } from '@/redux/hooks';
import { useConfigReadAndStore } from './functions/Config';
import { useEtaReadAndStore } from './functions/FetchEta';

export default async function DataLoader() {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  
  useConfigReadAndStore(dispatch, process.env.DEFAULT_CONFIG_FILE || '@config/f_etacfg.json');
  useEtaReadAndStore(dispatch, store.getState().config.data, store.getState().names2Id.data);
  
  //const configData = await readConfig(process.env.DEFAULT_CONFIG_FILE || '@config/f_etacfg.json');
  //store.dispatch(storeData(configData));

  return store;
}