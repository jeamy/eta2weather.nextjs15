import { ConfigKeys, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { DEFAULT_UPDATE_TIMER, MIN_API_INTERVAL } from '../reader/functions/types-constants/TimerConstants';
import { defaultNames2Id, EtaConstants } from '../reader/functions/types-constants/Names2IDconstants';
import { Config } from '../reader/functions/types-constants/ConfigConstants';
import { WifiAf83Api } from '../reader/functions/WifiAf83Api';
import { WifiAF83Data } from '../reader/functions/types-constants/WifiAf83';
import { EtaApi } from '../reader/functions/EtaApi';
import { store, RootState } from '../redux/store';
import { storeData as storeWifiAf83Data } from '../redux/wifiAf83Slice';
import { storeData as storeEtaData } from '../redux/etaSlice';
import { storeData as storeConfigData } from '../redux/configSlice';
import { storeData as storeNames2IdData } from '../redux/names2IdSlice';
import { getAllUris } from '../utils/etaUtils';
import { MenuNode } from '@/types/menu';
import { EtaPos, EtaButtons } from '@/reader/functions/types-constants/EtaConstants';
import { logData } from '@/utils/logging';
import { getWifiAf83Data } from '@/utils/cache';
import * as fs from 'fs';
import path from 'path';
import { calculateNewSliderPosition, calculateTemperatureDiff, updateSliderPosition } from '@/utils/Functions';

const CONFIG_FILE_PATH = path.join(process.cwd(), process.env.CONFIG_PATH || 'src/config/f_etacfg.json');

// Export the store getter for API routes
export function getServerStore() {
  return store;
}

export class BackgroundService {
  private static instance: BackgroundService;
  private updateInterval: NodeJS.Timeout | null = null;
  private config: Config = defaultConfig;
  private isRunning = false;
  private configWatcher: fs.FSWatcher | null = null;
  private lastConfigCheck = 0;
  private configCheckInterval = 10000;
  private isUpdating = false;
  private configChangeTimeout: NodeJS.Timeout | null = null;
  private lastConfigContent: string = '';
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private readonly MEMORY_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_HEAP_SIZE = 1024 * 1024 * 1024; // 1GB
  private readonly DATA_RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24 hours
  private etaApi: EtaApi | null = null;
  private lastTempState: {
    wasBelow: boolean;
    manualOverride: boolean;
    manualOverrideTime: number | null;
  } = {
      wasBelow: false,
      manualOverride: false,
      manualOverrideTime: null
    };
  private lastSliderUpdate: string | null = null;

  private constructor() { }

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
      // Initialize last config content
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        this.lastConfigContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      }

      // Watch the config file directory
      const configDir = path.dirname(CONFIG_FILE_PATH);
      this.configWatcher = fs.watch(configDir, (eventType, filename) => {
        if (filename === path.basename(CONFIG_FILE_PATH)) {
          const now = Date.now();
          // Only proceed if enough time has passed since last check
          if (now - this.lastConfigCheck >= this.configCheckInterval) {
            try {
              // Read current content and compare with last content
              const currentContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
              if (currentContent !== this.lastConfigContent) {
                this.lastConfigCheck = now;
                this.lastConfigContent = currentContent;
                this.handleConfigChange();
              }
            } catch (error) {
              console.error(`${this.getTimestamp()} Error reading config file:`, error);
            }
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

        /*
        this.loadAndStoreData().catch(error => {
          console.error(`${this.getTimestamp()} Error in background update:`, error);
        });
        */

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

  private async loadAndStoreData() {
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

      // Update update IndoorTemperature Diff  after new data is loaded
      await this.updateIndoorTemperatureDiff(transformedData);

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
      const state = store.getState() as RootState;
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
      const etaData = state.eta.data;
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
        // Clear outdated data from store with empty data objects
        store.dispatch(storeWifiAf83Data({
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
          temperature: 0,
          indoorTemperature: 0,
          allData: null
        }));
        store.dispatch(storeEtaData({}));
        console.log(`${this.getTimestamp()} Cleared outdated data from store`);
      }

      return needsRefresh;
    } catch (error) {
      console.error(`${this.getTimestamp()} Error during data cleanup:`, error);
      return false;
    }
  }

  private async updateIndoorTemperatureDiff(wifiData: WifiAF83Data) {
    try {
      const state = store.getState();
      const etaState = state.eta;
      const config = state.config;

      if (!config || !wifiData || !etaState) {
        return;
      }

      console.log(`${this.getTimestamp()} Updating temperature diff...`);
      const { diff: numericDiff } = calculateTemperatureDiff(config, {
        data: wifiData,
        loadingState: { isLoading: false, error: null }
      });

      if (numericDiff !== null) {
        console.log(`${this.getTimestamp()} Numeric diff: ${numericDiff}`);
        const newDiffValue = numericDiff.toString();
        // Only update if the diff value has changed
        if (newDiffValue !== config.data[ConfigKeys.DIFF]) {
          const etaValues = {
            einaus: etaState.data[defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id]?.strValue || '0',
            schaltzustand: etaState.data[defaultNames2Id[EtaConstants.SCHALTZUSTAND].id]?.strValue || '0',
            heizentaste: etaState.data[defaultNames2Id[EtaConstants.HEIZENTASTE].id]?.strValue || '0',
            kommentaste: etaState.data[defaultNames2Id[EtaConstants.KOMMENTASTE].id]?.strValue || '0',
            tes: Number(etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id]?.strValue || '0'),
            tea: Number(etaState.data[defaultNames2Id[EtaConstants.AUSSENTEMP].id]?.strValue || '0'),
          };

          console.log(`${this.getTimestamp()} Eta values: ${JSON.stringify(etaValues)}`);
          const newSliderPosition = calculateNewSliderPosition(etaValues, numericDiff);
          console.log(`${this.getTimestamp()} New slider position: ${newSliderPosition}`);
          if (newSliderPosition !== config.data[ConfigKeys.T_SLIDER] || newDiffValue !== config.data[ConfigKeys.DIFF]) {
            console.log(`${this.getTimestamp()} Updating temperature diff...`);
            store.dispatch(storeConfigData({
              ...config.data,
              [ConfigKeys.DIFF]: newDiffValue,
              [ConfigKeys.T_SLIDER]: newSliderPosition
            }));

            const { t_soll, t_delta } = config.data;
            // Log the temperature diff update
            console.log(`${this.getTimestamp()} Updated temperature diff ${t_soll} + ${t_delta} - ${wifiData.indoorTemperature} - Diff: ${newDiffValue}, Slider: ${newSliderPosition}`);
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

  private async updateTemperatureDiff(wifiData: WifiAF83Data) {
    try {
      const indoorTemp = wifiData.indoorTemperature;
      const minTemp = Number(this.config.t_min);

      if (isNaN(indoorTemp) || isNaN(minTemp)) {
        console.log(`${this.getTimestamp()} Invalid temperature values: indoor=${indoorTemp}, min=${minTemp}`);
        return;
      }

      const isBelow = indoorTemp < minTemp;
      console.log(`${this.getTimestamp()} Temperature state: isBelow=${isBelow}`);

      // Only act if temperature state has changed
      if (this.lastTempState.wasBelow !== isBelow) {
        const tempDiff = Number((minTemp - indoorTemp).toFixed(1));
        console.log(`${this.getTimestamp()} Temperature state changed: wasBelow=${this.lastTempState.wasBelow}, isBelow=${isBelow}, tempDiff=${tempDiff}`);

        // Log the temperature diff update
        await logData('min_temp_status', {
          timestamp: Date.now(),
          diff: tempDiff.toString(),
          isBelow: isBelow ? 'dropped below' : 'rose above',
          indoor: indoorTemp,
          minTemp: minTemp
        });
        // Get current state from Redux store
        const state = store.getState() as RootState;
        const etaState = state.eta;

        // Check for manual override
        const manualOverrideMinutes = parseInt(state.config.data?.t_override || '3');
        const manualOverrideTime = manualOverrideMinutes * 60 * 1000;
        let isManualOverride = false;

        // Find currently active button and check manual override
        let activeButton: EtaButtons | null = null;
        Object.entries(etaState.data).forEach(([_, item]) => {
          if (Object.values(EtaButtons).includes(item.short as EtaButtons) &&
            item.value === EtaPos.EIN &&
            item.short !== EtaButtons.AA) {
            activeButton = item.short as EtaButtons;
            // If a manual button is active, set manual override
            this.lastTempState.manualOverride = true;
            this.lastTempState.manualOverrideTime = Date.now();
            isManualOverride = true;
          }
        });

        // Check if manual override is still active
        if (this.lastTempState.manualOverride && this.lastTempState.manualOverrideTime) {
          const timeSinceOverride = Date.now() - this.lastTempState.manualOverrideTime;
          if (timeSinceOverride > manualOverrideTime) {
            // Reset manual override if time has expired
            this.lastTempState.manualOverride = false;
            this.lastTempState.manualOverrideTime = null;
            isManualOverride = false;
          } else {
            isManualOverride = true;
          }
        }

        if (!isManualOverride) {
          const buttonIds = {
            [EtaButtons.HT]: defaultNames2Id[EtaConstants.HEIZENTASTE].id,
            [EtaButtons.KT]: defaultNames2Id[EtaConstants.KOMMENTASTE].id,
            [EtaButtons.AA]: defaultNames2Id[EtaConstants.AUTOTASTE].id,
            [EtaButtons.GT]: defaultNames2Id[EtaConstants.GEHENTASTE].id,
            [EtaButtons.DT]: defaultNames2Id[EtaConstants.ABSENKTASTE].id
          };

          const targetButtonName = isBelow ? EtaButtons.KT : EtaButtons.AA;
          const targetButton = buttonIds[targetButtonName];

          if (!targetButton) {
            throw new Error(`Button ID not found for ${targetButtonName}`);
          }

          try {
            // Initialize EtaApi
            const etaApi = new EtaApi(this.config.s_eta);

            // First turn off all buttons except AA
            console.log(`${this.getTimestamp()} Turning off all buttons (except AA) before activating ${targetButtonName}`);

            await Promise.all(Object.entries(buttonIds).map(async ([name, id]) => {
              if (name !== EtaButtons.AA && name !== targetButtonName) {
                await etaApi.setUserVar(id, EtaPos.AUS, "0", "0");
              }
            }));

            // Then activate target button
            console.log(`${this.getTimestamp()} Activating ${targetButtonName}`);
            await etaApi.setUserVar(targetButton, EtaPos.EIN, "0", "0");

            // Special handling for AA button - turn it off if target is not AA
            if (targetButtonName !== EtaButtons.AA) {
              console.log(`${this.getTimestamp()} Turning off AA button as manual button will be active`);
              await etaApi.setUserVar(buttonIds[EtaButtons.AA], EtaPos.AUS, "0", "0");
            }

            // Update state
            this.lastTempState.wasBelow = isBelow;

          } catch (error) {
            console.error(`${this.getTimestamp()} Error updating temperature state:`, error);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error(`${this.getTimestamp()} Error in updateTemperatureDiff:`, error);
    }
  }

  private async updateTemperatureDiffWithServerCheck(wifiData: WifiAF83Data) {
    try {
      /*
      const serverReady = await this.isServerReady('/api/health');
      if (!serverReady) {
        console.error('Server is not ready. Aborting update.');
        return;
      }
      */
      await this.updateTemperatureDiff(wifiData);
    } catch (error) {
      console.error(`${this.getTimestamp()} Error in updateTemperatureDiffWithServerCheck:`, error);
      throw error;
    }
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

    try {
      this.isRunning = true;
      console.log(`${this.getTimestamp()} Starting background service...`);

      // Start memory monitoring
      this.memoryMonitorInterval = setInterval(() => {
        this.monitorMemoryUsage();
      }, this.MEMORY_CHECK_INTERVAL);
      console.log(`${this.getTimestamp()} Memory monitoring started`);

      // Load initial config
      this.config = await this.loadConfig();

      // Start config watcher
      this.startConfigWatcher();

      // Load initial data
      await this.loadAndStoreData();

      // Start update interval
      this.restartUpdateInterval();

      console.log(`${this.getTimestamp()} Background service started successfully`);
    } catch (error) {
      console.error(`${this.getTimestamp()} Error starting background service:`, error);
      this.stop();
      throw error;
    }
  }

  stop() {
    console.log(`${this.getTimestamp()} Stopping background service...`);

    // Clear memory monitoring interval
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      console.log(`${this.getTimestamp()} Memory monitoring stopped`);
    }

    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Stop config watcher
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
    }

    // Clear config change timeout
    if (this.configChangeTimeout) {
      clearTimeout(this.configChangeTimeout);
      this.configChangeTimeout = null;
    }

    this.isRunning = false;
    console.log(`${this.getTimestamp()} Background service stopped`);
  }
}
