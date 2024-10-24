import { makeStore } from '../redux';
import { storeData } from '../redux/configSlice';
import { readConfig } from './serverfunctions/Config';
import { useConfigReadAndStore } from './functions/Config';

export default async function DataLoader() {
  const store = makeStore();
  useConfigReadAndStore(store, process.env.DEFAULT_CONFIG_FILE || '@config/f_etacfg.json');
  
  //const configData = await readConfig(process.env.DEFAULT_CONFIG_FILE || '@config/f_etacfg.json');
  //store.dispatch(storeData(configData));

  // Wir geben hier nichts zurück, da wir nur den Store aktualisieren
  return store;
}