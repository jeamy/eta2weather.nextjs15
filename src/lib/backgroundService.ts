import { ConfigKeys, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '../reader/functions/types-constants/TimerConstants';
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
import { calculateTemperatureDiff, calculateNewSliderPosition, updateSliderPosition } from '@/utils/Functions';
import { getAllUris } from '@/utils/etaUtils';
import { MenuNode } from '@/types/menu';
import { EtaPos } from '@/reader/functions/types-constants/EtaConstants';

const CONFIG_FILE_PATH = path.join(process.cwd(), process.env.CONFIG_PATH || 'src/config/f_etacfg.json');

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
  private etaApi: EtaApi | null = null;
  private lastSliderUpdate: string | null = null;

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
        
        this.loadAndStoreData().catch(error => {
          console.error(`${this.getTimestamp()} Error in background update:`, error);
        });

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

  private async updateTemperatureDiff(wifiData: WifiAF83Data) {
    try {
      const state = store.getState();
      const etaState = state.eta;
      const config = state.config.data;

      if (!config || !wifiData || !etaState?.data) {
        return;
      }

      // Calculate temperature difference
      const indoorTemp = wifiData.indoorTemperature;
      const minTemp = Number(config.t_min);

      if (!isNaN(indoorTemp) && !isNaN(minTemp)) {
        const tempDiff = Number((minTemp - indoorTemp).toFixed(1));
        console.log(`${this.getTimestamp()} Temperature difference: ${tempDiff}°C (min: ${minTemp}°C, indoor: ${indoorTemp}°C)`);

        // Update config with new temperature difference directly in the JSON file
        const data = await fs.promises.readFile(CONFIG_FILE_PATH, 'utf-8');
        let config = JSON.parse(data);
        config[ConfigKeys.TEMP_DIFF] = tempDiff.toString();
        await fs.promises.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));

        console.log(`${this.getTimestamp()} Updated temperature difference in config file to ${tempDiff}°C`);

        // Only update states if temperature difference has changed
        const currentTempDiff = Number(config[ConfigKeys.TEMP_DIFF]);
        if (tempDiff !== currentTempDiff) {
          console.log(`${this.getTimestamp()} Temperature difference changed from ${currentTempDiff}°C to ${tempDiff}°C`);
          store.dispatch(storeConfigData(config));
          // Get all button IDs
          const buttonIds = {
            ht: defaultNames2Id[EtaConstants.HEIZENTASTE].id,
            kt: defaultNames2Id[EtaConstants.KOMMENTASTE].id,
            aa: defaultNames2Id[EtaConstants.AUTOTASTE].id,
            gt: defaultNames2Id[EtaConstants.GEHENTASTE].id,
            dt: defaultNames2Id[EtaConstants.ABSENKTASTE].id
          };

          // Verify all button IDs exist
          if (!Object.values(buttonIds).every(id => id)) {
            console.error(`${this.getTimestamp()} Some button IDs not found`);
            return;
          }

          // Determine target button based on temperature
          let targetButton: string;
          if (tempDiff > 0) {
            targetButton = buttonIds.kt; // Activate Kommen when below min temp
          } else {
            targetButton = buttonIds.aa; // Activate Auto when at or above min temp
          }

          try {
            // Set all other buttons to Aus
            const updates = Object.values(buttonIds)
              .filter(id => id !== targetButton)
              .map(id => 
                fetch('/api/eta/update', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    id: id,
                    value: EtaPos.AUS,
                    begin: "0",
                    end: "0"
                  })
                })
              );

            await Promise.all(updates);

            // Set target button to Ein
            await fetch('/api/eta/update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: targetButton,
                value: EtaPos.EIN,
                begin: "0",
                end: "0"
              })
            });

            console.log(`${this.getTimestamp()} Updated all button states (${tempDiff > 0 ? 'KT' : 'AA'} activated)`);
          } catch (error) {
            console.error(`${this.getTimestamp()} Error updating button states:`, error);
          }
        }
      }

      // Continue with existing temperature diff logic
      console.log(`${this.getTimestamp()} Updating temperature diff...`);
      const { diff: numericDiff } = calculateTemperatureDiff({
        data: config,
        loadingState: { isLoading: false, error: null },
        isInitialized: true
      }, { 
        data: wifiData,
        loadingState: { isLoading: false, error: null }
      });
      
      if (numericDiff !== null) {
        console.log(`${this.getTimestamp()} Numeric diff: ${numericDiff}`);
        const newDiffValue = numericDiff.toString();
        // Only update if the diff value has changed
        if (newDiffValue !== config[ConfigKeys.DIFF]) {
          const etaValues = {
            einaus: etaState.data[defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id]?.strValue || '0',
            schaltzustand: etaState.data[defaultNames2Id[EtaConstants.SCHALTZUSTAND].id]?.strValue || '0',
            heizentaste: etaState.data[defaultNames2Id[EtaConstants.HEIZENTASTE].id]?.strValue || '0',
            kommentaste: etaState.data[defaultNames2Id[EtaConstants.KOMMENTASTE].id]?.strValue || '0',
            tes: Number(etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id]?.strValue || '0'),
            tea: Number(etaState.data[defaultNames2Id[EtaConstants.AUSSENTEMP].id]?.strValue || '0'),
          };

          const newSliderPosition = calculateNewSliderPosition(etaValues, numericDiff);
          console.log(`${this.getTimestamp()} New slider position: ${newSliderPosition}`);
          if (newSliderPosition !== config[ConfigKeys.T_SLIDER] || newDiffValue !== config[ConfigKeys.DIFF]) {
            console.log(`${this.getTimestamp()} Updating temperature diff...`);
            store.dispatch(storeConfigData({
              ...config,
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

            // Update the physical slider position if needed
            const recommendedPos = Math.round(parseFloat(newSliderPosition));
            const etaSP = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
            const currentPos = etaSP ? parseFloat(etaSP.strValue || '0') : recommendedPos;
            console.log(`${this.getTimestamp()} Current slider position: ${currentPos}, Recommended slider position: ${recommendedPos}`);
            // Only update if the positions are different, values are valid, and it's not the same update
            if (etaSP && 
                recommendedPos !== currentPos && 
                !isNaN(recommendedPos) && 
                !isNaN(currentPos) &&
                this.lastSliderUpdate !== newSliderPosition) {
                
                this.lastSliderUpdate = newSliderPosition;
                
                if (!this.etaApi) {
                    console.error(`${this.getTimestamp()} EtaApi not initialized`);
                    return;
                }

                try {
                    console.log(`${this.getTimestamp()} Update slider position from ${currentPos} to ${recommendedPos}`);

                    const result = await updateSliderPosition(
                        recommendedPos,
                        currentPos,
                        defaultNames2Id,
                        this.etaApi
                    );
                    
                    if (result.success) {
                        // Update the SP value in the Redux store
                        const updatedEtaData = { ...etaState.data };
                        const spId = defaultNames2Id[EtaConstants.SCHIEBERPOS].id;
                        if (updatedEtaData[spId]) {
                            updatedEtaData[spId] = {
                                ...updatedEtaData[spId],
                                strValue: (result.position).toString()
                            };
                            store.dispatch(storeEtaData(updatedEtaData));
                            console.log(`${this.getTimestamp()} Successfully updated slider position to ${result.position}`);
                        }
                    } else if (result.error) {
                        console.error(`${this.getTimestamp()} Failed to update slider position:`, result.error);
                    }
                } catch (error) {
                    console.error(`${this.getTimestamp()} Error updating slider position:`, error);
                }
            }
          }
        }
      }
    } catch (error) {
      console.error(`${this.getTimestamp()} Error updating temperature diff:`, error);
    }
  }

  private async updateTemperatureDiffWithServerCheck(wifiData: WifiAF83Data) {
/*    
    const serverReady = await this.isServerReady('/api/health');
    if (!serverReady) {
      console.error('Server is not ready. Aborting update.');
      return;
    }
*/      
    await this.updateTemperatureDiff(wifiData);
  }

  private async isServerReady(url: string, retries = 5, delay = 2000): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        console.warn(`Server not ready, retrying... (${i + 1}/${retries})`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return false;
  }

  async start() {
    if (this.isRunning) {
      console.log(`${this.getTimestamp()} Background service is already running`);
      return;
    }

    console.log(`${this.getTimestamp()} Loading configuration...`);
    this.config = await this.loadConfig();
    
    // Initialize EtaApi
    if (this.config[ConfigKeys.S_ETA]) {
      this.etaApi = new EtaApi(this.config[ConfigKeys.S_ETA]);
    }
    
    console.log(`${this.getTimestamp()} Starting config file watcher...`);
    this.startConfigWatcher();
    
    // Start memory monitoring
    this.memoryMonitorInterval = setInterval(() => {
      this.monitorMemoryUsage();
    }, this.MEMORY_CHECK_INTERVAL);
    
    console.log(`${this.getTimestamp()} Background service started`);
    
    try {
      // Set up periodic updates
      this.restartUpdateInterval();

      // Initial load of all data
      await this.loadAndStoreData();


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

  async loadAndStoreData() {
    if (this.isUpdating) {
      console.log(`${this.getTimestamp()} Update already in progress, skipping...`);
      return;
    }

    this.isUpdating = true;
    try {
      // Run cleanup before loading new data
      await this.cleanupOldData();
      
      // Create EtaApi instance if not exists
      if (!this.etaApi) {
        this.etaApi = new EtaApi(this.config[ConfigKeys.S_ETA]);
      }

      // Get menu data first
      console.log(`${this.getTimestamp()} Fetching ETA menu data...`);
      const menuResponse = await this.etaApi.getMenu();
      if (menuResponse.error || !menuResponse.result) {
        throw new Error(menuResponse.error || 'No ETA menu data received');
      }

      // Parse menu XML to get menu nodes
      const menuNodes: MenuNode[] = [];
      const parseMenuXML = (xmlString: string) => {
        const getAttributeValue = (line: string, attr: string): string => {
          const match = line.match(new RegExp(`${attr}="([^"]+)"`));
          return match ? match[1] : '';
        };

        const lines = xmlString.split('\n');
        const nodeStack: MenuNode[] = [];
        
        lines.forEach(line => {
          if (!line.trim() || line.includes('<?xml') || line.includes('</eta>')) {
            return;
          }

          if (line.includes('<eta')) {
            // Root node
            return;
          }

          const uri = getAttributeValue(line, 'uri');
          const name = getAttributeValue(line, 'name');

          if (uri && name) {
            const node: MenuNode = {
              uri,
              name,
              children: []
            };

            if (line.includes('</node>')) {
              // Leaf node
              if (nodeStack.length > 0) {
                nodeStack[nodeStack.length - 1].children?.push(node);
              } else {
                menuNodes.push(node);
              }
            } else {
              // Parent node
              if (nodeStack.length > 0) {
                nodeStack[nodeStack.length - 1].children?.push(node);
              } else {
                menuNodes.push(node);
              }
              nodeStack.push(node);
            }
          } else if (line.includes('</node>') && nodeStack.length > 0) {
            nodeStack.pop();
          }
        });
      };

      parseMenuXML(menuResponse.result);

      // Get all URIs from the menu tree
      console.log(`${this.getTimestamp()} Getting URIs from menu tree...`);
      const uris = getAllUris(menuNodes);
      console.log(`${this.getTimestamp()} Found ${uris.length} URIs to fetch`);

      // Fetch data in batches using EtaApi
      console.log(`${this.getTimestamp()} Fetching ETA data...`);
      const menuData: Record<string, string> = {};
      const batchSize = 5; // Process 5 URIs at a time
      
      for (let i = 0; i < uris.length; i += batchSize) {
        const batch = uris.slice(i, i + batchSize);
        const promises = batch.map(async (uri) => {
          try {
            // Remove leading slash if present
            const id = uri.replace(/^\//, '');
            const response = await this.etaApi!.getUserVar(id);
            if (response.result) {
              menuData[uri] = response.result;
            }
          } catch (error) {
            console.warn(`${this.getTimestamp()} Failed to fetch data for URI ${uri}:`, error);
          }
        });

        await Promise.all(promises);
        
        // Add a small delay between batches to prevent overwhelming the server
        if (i + batchSize < uris.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`${this.getTimestamp()} Successfully fetched ETA data for ${Object.keys(menuData).length} URIs`);

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
      await this.updateTemperatureDiffWithServerCheck(transformedData);

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
