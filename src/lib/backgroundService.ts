import { ConfigKeys, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '../reader/functions/types-constants/TimerConstants';
import { fetchEtaData, parseXML } from '../reader/functions/EtaData';
import { defaultNames2Id, EtaConstants } from '../reader/functions/types-constants/Names2IDconstants';
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
import { EtaApi } from '@/reader/functions/EtaApi';
import Diff from '@/reader/functions/Diff';

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
  private isUpdating = false;
  private configChangeTimeout: NodeJS.Timeout | null = null;
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private readonly MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_HEAP_SIZE = 1024 * 1024 * 1024; // 1GB
  private readonly DATA_RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  private getTimestamp(): string {
    return `[${new Date().toISOString()}]`;
  }

  private async loadConfig(): Promise<Config> {
    try {
      if (!fs.existsSync(CONFIG_FILE_PATH)) {
        console.log(`${this.getTimestamp()} Config file does not exist. Creating with default values.`);
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2));
        store.dispatch(storeConfigData(defaultConfig));
        return defaultConfig;
      }

      let retries = 3;
      let lastError: Error | null = null;

      while (retries > 0) {
        try {
          const rawData = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
          if (!rawData.trim()) {
            throw new Error('Config file is empty');
          }

          const configData = JSON.parse(rawData);
          console.log(`${this.getTimestamp()} Config loaded successfully`);
          store.dispatch(storeConfigData(configData));
          return configData;
        } catch (error) {
          lastError = error as Error;
          retries--;
          if (retries > 0) {
            console.log(`${this.getTimestamp()} Retrying config load... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      console.error(`${this.getTimestamp()} Failed to load config after retries:`, lastError);
      store.dispatch(storeConfigData(defaultConfig));
      return defaultConfig;
    } catch (error) {
      console.error(`${this.getTimestamp()} Error loading config:`, error);
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

      console.log(`${this.getTimestamp()} Config file watcher started`);
    } catch (error) {
      console.error(`${this.getTimestamp()} Error starting config watcher:`, error);
    }
  }

  private handleConfigChange() {
    if (this.configChangeTimeout) {
      clearTimeout(this.configChangeTimeout);
    }
    
    this.configChangeTimeout = setTimeout(async () => {
      try {
        console.log(`${this.getTimestamp()} Config file changed, reloading...`);
        const newConfig = await this.loadConfig();
        const oldUpdateTimer = parseInt(this.config[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER;
        const newUpdateTimer = parseInt(newConfig[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER;

        console.log(`${this.getTimestamp()} Logging CONFIG data...`);
        await logData('config', newConfig);
        console.log(`${this.getTimestamp()} Logging CONFIG data DONE!`);
        this.config = newConfig;

        if (oldUpdateTimer !== newUpdateTimer && this.isRunning) {
          console.log(`${this.getTimestamp()} Update timer changed, restarting interval...`);
          this.restartUpdateInterval();
        }
      } catch (error) {
        console.error(`${this.getTimestamp()} Error handling config change:`, error);
      } finally {
        this.configChangeTimeout = null;
      }
    }, 2000);
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
        console.error(`${this.getTimestamp()} Error in background update:`, error);
      });
    }, updateTimer);

    console.log(`${this.getTimestamp()} Update interval restarted with timer: ${updateTimer}ms`);
  }

  private monitorMemoryUsage() {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    
    console.log(`${this.getTimestamp()} Memory usage - heapTotal: ${heapTotalMB}MB, heapUsed: ${heapUsedMB}MB`);
    
    // Alert if memory usage is too high
    if (used.heapUsed > this.MAX_HEAP_SIZE) {
      console.warn(`${this.getTimestamp()} High memory usage detected! Running emergency cleanup...`);
      this.cleanupOldData(true).catch(error => {
        console.error(`${this.getTimestamp()} Error during emergency cleanup:`, error);
      });
      global.gc?.(); // Optional: Force garbage collection if --expose-gc flag is set
    }
  }

  private async cleanupOldData(emergency: boolean = false) {
    console.log(`${this.getTimestamp()} Running data cleanup${emergency ? ' (emergency)' : ''}...`);
    
    try {
      const state = store.getState();
      const retentionPeriod = emergency ? this.DATA_RETENTION_PERIOD / 2 : this.DATA_RETENTION_PERIOD;
      const cutoffTime = Date.now() - retentionPeriod;

      let needsRefresh = false;

      // Check WiFi AF83 data
      const wifiData = state.wifiAf83.data;
      if (wifiData?.time && wifiData.time < cutoffTime) {
        console.log(`${this.getTimestamp()} WiFi AF83 data is outdated`);
        needsRefresh = true;
      }

      // Check ETA data
      const etaData = state.eta;
      if (etaData) {
        const hasOldData = Object.values(etaData).some((value: any) => 
          value?.timestamp && value.timestamp < cutoffTime
        );
        if (hasOldData) {
          console.log(`${this.getTimestamp()} ETA data is outdated`);
          needsRefresh = true;
        }
      }

      // If any data is outdated, refresh all data
      if (needsRefresh) {
        console.log(`${this.getTimestamp()} Refreshing all data...`);
        await this.loadAndStoreData();
        console.log(`${this.getTimestamp()} Data refresh complete`);
      } else {
        console.log(`${this.getTimestamp()} All data is current, no refresh needed`);
      }
    } catch (error) {
      console.error(`${this.getTimestamp()} Error during data cleanup and refresh:`, error);
    }
  }

  private calculateTemperatureDiff(wifiData: WifiAF83Data): { diff: number | null; twa: number; twi: number } {
    const state = store.getState();
    const config = state.config;

    const twi = wifiData.indoorTemperature;
    const twa = wifiData.temperature ?? 0;
    const { t_soll, t_delta } = config.data;

    const tSollNum = Number(t_soll);
    const tDeltaNum = Number(t_delta);

    if (isNaN(tSollNum) || isNaN(tDeltaNum) || isNaN(twi)) {
      console.error(`${this.getTimestamp()} Invalid temperature values:`, { t_soll, t_delta, twi });
      return { diff: null, twa, twi };
    }

    const diff = Math.min(tSollNum + tDeltaNum - twi, 5.0);
    return { diff: Number(diff.toFixed(1)), twa, twi };
  }

  private calculateNewSliderPosition(etaValues: { einaus: string; schaltzustand: string; heizentaste: string }, diff: number): string {
    return (etaValues.einaus === "Aus" || (etaValues.schaltzustand === "Aus" && etaValues.heizentaste === "Aus"))
      ? "0.0"
      : new Diff().getDiff(diff, 1.25, 5.0, 0.0, 100.0).toString();
  }

  private async updateTemperatureDiff(wifiData: WifiAF83Data) {
    try {
      const state = store.getState();
      const etaState = state.eta;
      const config = state.config;

      if (!config || !wifiData || !etaState) {
        return;
      }

      const { diff: numericDiff } = this.calculateTemperatureDiff(wifiData);
      
      if (numericDiff !== null) {
        const newDiffValue = numericDiff.toString();
        // Only update if the diff value has changed
        if (newDiffValue !== config.data[ConfigKeys.DIFF]) {
          const etaValues = {
            einaus: etaState.data[defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id]?.strValue || '0',
            schaltzustand: etaState.data[defaultNames2Id[EtaConstants.SCHALTZUSTAND].id]?.strValue || '0',
            heizentaste: etaState.data[defaultNames2Id[EtaConstants.HEIZENTASTE].id]?.strValue || '0',
            tes: Number(etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id]?.strValue || '0'),
            tea: Number(etaState.data[defaultNames2Id[EtaConstants.AUSSENTEMP].id]?.strValue || '0'),
          };

          const newSliderPosition = this.calculateNewSliderPosition(etaValues, numericDiff);
          
          if (newSliderPosition !== config.data[ConfigKeys.T_SLIDER] || newDiffValue !== config.data[ConfigKeys.DIFF]) {
            store.dispatch(storeConfigData({
              ...config.data,
              [ConfigKeys.DIFF]: newDiffValue,
              [ConfigKeys.T_SLIDER]: newSliderPosition
            }));

            // Log the temperature diff update
            console.log(`${this.getTimestamp()} Updated temperature diff - Diff: ${newDiffValue}, Slider: ${newSliderPosition}`);
            await logData('temp_diff', { 
              timestamp: Date.now(),
              diff: newDiffValue,
              sliderPosition: newSliderPosition,
              indoor: wifiData.indoorTemperature,
              outdoor: wifiData.temperature
            });
          }
        }
      }
    } catch (error) {
      console.error(`${this.getTimestamp()} Error updating temperature diff:`, error);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log(`${this.getTimestamp()} Background service is already running`);
      return;
    }

    console.log(`${this.getTimestamp()} Loading configuration...`);
    this.config = await this.loadConfig();
    console.log(`${this.getTimestamp()} Starting config file watcher...`);
    this.startConfigWatcher();
    
    // Start memory monitoring
    this.memoryMonitorInterval = setInterval(() => {
      this.monitorMemoryUsage();
    }, this.MEMORY_CHECK_INTERVAL);
    
    console.log(`${this.getTimestamp()} Background service started`);
    
    try {
      // Initial load of all data
      await this.loadAndStoreData();

      // Set up periodic updates
      this.restartUpdateInterval();

      this.isRunning = true;
      console.log(`${this.getTimestamp()} Background service initialization complete`);
    } catch (error) {
      console.error(`${this.getTimestamp()} Error starting background service:`, error);
      throw error;
    }
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.configWatcher) {
      try {
        this.configWatcher.close();
      } catch (error) {
        console.error(`${this.getTimestamp()} Error closing config watcher:`, error);
      }
      this.configWatcher = null;
    }
    if (this.configChangeTimeout) {
      clearTimeout(this.configChangeTimeout);
      this.configChangeTimeout = null;
    }
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
    this.isRunning = false;
    this.isUpdating = false;
    console.log(`${this.getTimestamp()} Background service stopped`);
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  private async loadAndStoreData() {
    if (this.isUpdating) {
      console.log(`${this.getTimestamp()} Update already in progress, skipping...`);
      return;
    }
    
    this.isUpdating = true;
    try {
      // Run cleanup before loading new data
      await this.cleanupOldData();
      
      // Create EtaApi instance
      const etaApi = new EtaApi(this.config[ConfigKeys.S_ETA]);

      // Get menu data first
      console.log(`${this.getTimestamp()} Fetching ETA data...`);
      const menuResponse = await etaApi.getMenu();
      if (menuResponse.error || !menuResponse.result) {
        throw new Error(menuResponse.error || 'No ETA data received');
      }

      // Parse menu XML to get all URIs
      const urisToFetch = new Set<string>();
      const menuData: Record<string, any> = {};

      // Helper function to collect URIs from menu nodes
      const collectUris = (node: any) => {
        if (node.uri) {
          urisToFetch.add(node.uri);
        }
        node.children?.forEach(collectUris);
      };

      // Parse and collect URIs from menu XML
      const parseMenuXML = (xmlString: string) => {
        const getAttributeValue = (line: string, attr: string): string => {
          const match = line.match(new RegExp(`${attr}="([^"]+)"`));
          return match ? match[1] : '';
        };

        const lines = xmlString.split('\n');
        lines.forEach(line => {
          if (!line.trim() || line.includes('<?xml') || line.includes('</eta>') || line.includes('<eta')) {
            return;
          }
          const uri = getAttributeValue(line, 'uri');
          const name = getAttributeValue(line, 'name');
          if (uri && name) {
            urisToFetch.add(uri);
          }
        });
      };

      parseMenuXML(menuResponse.result);

      // Fetch data for all URIs
      console.log(`${this.getTimestamp()} Fetching data for ${urisToFetch.size} URIs...`);
      for (const uri of urisToFetch) {
        try {
          console.error(`${this.getTimestamp()} Fetching data for URI ${uri}:`);
          const response = await etaApi.getUserVar(uri);
          if (response.result) {
            const parsedData = parseXML(response.result, uri, null);
            menuData[uri] = parsedData;
          }
          // Add a small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1));
        } catch (error) {
          console.error(`${this.getTimestamp()} Error fetching data for URI ${uri}:`, error);
        }
      }

      // Log all ETA data
      console.log(`${this.getTimestamp()} Logging ETA data...`);
      await logData('eta', menuData);
      console.log(`${this.getTimestamp()} Logging ETA data DONE!`);

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

      console.log(`${this.getTimestamp()} WiFi AF83 data updated`);
      store.dispatch(storeWifiAf83Data(transformedData));
      console.log(`${this.getTimestamp()} Logging ECOWITT data...`);
      await logData('ecowitt', transformedData);
      console.log(`${this.getTimestamp()} Logging ECOWITT data DONE!`);

      // Update temperature diff after new data is loaded
      await this.updateTemperatureDiff(transformedData);

      // Update names2Id in store
      store.dispatch(storeNames2IdData(defaultNames2Id));

      return { etaData: menuData, wifiData: transformedData };
    } catch (error) {
      console.error(`${this.getTimestamp()} Error loading and storing data:`, error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }
}

export const backgroundService = BackgroundService.getInstance();

// Export store for potential use in other server-side code
export const getServerStore = () => store;
