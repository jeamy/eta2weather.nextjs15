import { ConfigKeys, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '../reader/functions/types-constants/TimerConstants';
import { fetchEtaData } from '../reader/functions/EtaData';
import { defaultNames2Id } from '../reader/functions/types-constants/Names2IDconstants';
import { Config } from '../reader/functions/types-constants/ConfigConstants';
import { WifiAf83Api } from '../reader/functions/WifiAf83Api';
import { WifiAF83Data } from '../reader/functions/types-constants/WifiAf83';
import fs from 'fs';
import path from 'path';
import { configureStore } from '@reduxjs/toolkit';
import configReducer, { storeData as storeConfigData } from '../redux/configSlice';
import etaReducer, { storeData as storeEtaData } from '../redux/etaSlice';
import wifiAf83Reducer, { storeData as storeWifiAf83Data } from '../redux/wifiAf83Slice';
import names2IdReducer, { storeData as storeNames2IdData } from '../redux/names2IdSlice';
import { logData } from '@/utils/logging';
import { getWifiAf83Data } from '@/utils/cache';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

// Create a server-side Redux store
const store = configureStore({
  reducer: {
    config: configReducer,
    eta: etaReducer,
    wifiAf83: wifiAf83Reducer,
    names2Id: names2IdReducer,
  },
});

class BackgroundService {
  private static instance: BackgroundService;
  private updateInterval: NodeJS.Timeout | null = null;
  private config: Config = defaultConfig;
  private isRunning = false;
  private configWatcher: fs.FSWatcher | null = null;
  private lastConfigCheck = 0;
  private configCheckInterval = 1000; // Check config file every second

  private constructor() {}

  static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  private loadConfig(): Config {
    try {
      if (!fs.existsSync(CONFIG_FILE_PATH)) {
        console.log('Config file does not exist. Creating with default values.');
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2));
        store.dispatch(storeConfigData(defaultConfig));
        return defaultConfig;
      }

      // Add retry logic for reading the file
      let retries = 3;
      let lastError: Error | null = null;

      while (retries > 0) {
        try {
          const rawData = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
          if (!rawData.trim()) {
            throw new Error('Config file is empty');
          }

          const configData = JSON.parse(rawData);
          console.log('Config loaded successfully');
          store.dispatch(storeConfigData(configData));
          return configData;
        } catch (error) {
          lastError = error as Error;
          retries--;
          if (retries > 0) {
            // Wait a bit before retrying
            console.log(`Retrying config load... (${retries} attempts remaining)`);
            // Sleep for 100ms
            const start = Date.now();
            while (Date.now() - start < 100) {
              // Busy wait
            }
          }
        }
      }

      // If we get here, all retries failed
      console.error('Failed to load config after retries:', lastError);
      store.dispatch(storeConfigData(defaultConfig));
      return defaultConfig;
    } catch (error) {
      console.error('Error loading config:', error);
      store.dispatch(storeConfigData(defaultConfig));
      return defaultConfig;
    }
  }

  private startConfigWatcher() {
    if (this.configWatcher) {
      return;
    }

    try {
      // Watch the config file directory
      const configDir = path.dirname(CONFIG_FILE_PATH);
      this.configWatcher = fs.watch(configDir, (eventType, filename) => {
        if (filename === path.basename(CONFIG_FILE_PATH)) {
          const now = Date.now();
          // Debounce config reloading to prevent multiple reloads
          if (now - this.lastConfigCheck >= this.configCheckInterval) {
            this.lastConfigCheck = now;
            this.handleConfigChange();
          }
        }
      });

      console.log('Config file watcher started');
    } catch (error) {
      console.error('Error starting config watcher:', error);
    }
  }

  private async handleConfigChange() {
    try {
      console.log('Config file changed, waiting before reload...');
      // Wait for 2 seconds before attempting to reload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Reloading config...');
      const newConfig = this.loadConfig();
      const oldUpdateTimer = parseInt(this.config[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER;
      const newUpdateTimer = parseInt(newConfig[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER;

      // Log the config change
      await logData('config', newConfig);

      this.config = newConfig;

      // If the update timer has changed, restart the interval
      if (oldUpdateTimer !== newUpdateTimer && this.isRunning) {
        console.log('Update timer changed, restarting interval...');
        this.restartUpdateInterval();
      }
    } catch (error) {
      console.error('Error handling config change:', error);
    }
  }

  private restartUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    const updateTimer = Math.max(
      parseInt(this.config[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER,
      MIN_API_INTERVAL
    );

    this.updateInterval = setInterval(() => {
      this.loadAndStoreData().catch(error => {
        console.error('Error in background update:', error);
      });
    }, updateTimer);

    console.log(`Update interval restarted with timer: ${updateTimer}ms`);
  }

  async start() {
    if (this.isRunning) {
      console.log('Background service is already running');
      return;
    }

    console.log('Loading configuration...');
    this.config = this.loadConfig();
    console.log('Starting config file watcher...');
    this.startConfigWatcher();
    console.log('Background service started');
    
    try {
      // Initial load of all data
      await this.loadAndStoreData();

      // Set up periodic updates
      this.restartUpdateInterval();

      this.isRunning = true;
      console.log('Background service initialization complete');
    } catch (error) {
      console.error('Error starting background service:', error);
      throw error;
    }
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
    }
    this.isRunning = false;
    console.log('Background service stopped');
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  private async loadAndStoreData() {
    try {
      // Load ETA data using default names2Id
      const etaData = await fetchEtaData(this.config, defaultNames2Id);
      console.log('ETA data updated');
      store.dispatch(storeEtaData(etaData));
      await logData('eta', etaData);

      // Load WiFi AF83 data
      const wifiApi = new WifiAf83Api();
      const allData = await getWifiAf83Data(() => wifiApi.getAllRealtime());
      
      // Extract and validate temperature values
      const outdoorTemp = allData.outdoor?.temperature?.value;
      const indoorTemp = allData.indoor?.temperature?.value;

      if (!outdoorTemp || !indoorTemp) {
        throw new Error('Invalid temperature values');
      }

      // Transform to match WifiAF83Data interface
      const transformedData = {
        time: Date.now(),
        datestring: new Date().toLocaleString('de-DE', {
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        temperature: parseFloat(outdoorTemp),
        indoorTemperature: parseFloat(indoorTemp),
        allData: allData
      };

      console.log('WiFi AF83 data updated');
      store.dispatch(storeWifiAf83Data(transformedData));
      await logData('ecowitt', transformedData);

      // Update names2Id in store
      store.dispatch(storeNames2IdData(defaultNames2Id));

      return { etaData, wifiData: transformedData };
    } catch (error) {
      console.error('Error loading and storing data:', error);
      throw error;
    }
  }
}

export const backgroundService = BackgroundService.getInstance();

// Export store for potential use in other server-side code
export const getServerStore = () => store;
