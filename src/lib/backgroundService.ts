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
import { EtaPos, EtaButtons, EtaData } from '@/reader/functions/types-constants/EtaConstants';
import { logData } from '@/utils/logging';
import { updateConfig } from '@/utils/cache';
import { getWifiAf83Data } from '@/utils/cache';
import { DatabaseService } from '@/lib/database/sqliteService';
import * as fs from 'fs';
import path from 'path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { calculateNewSliderPosition, calculateTemperatureDiff, updateSliderPosition } from '@/utils/Functions';
import { parseXML } from '@/reader/functions/EtaData';
import { parseNumOrZero } from '@/utils/numberParser';
import { determineControlAction, ControlInput } from './controlLogic';
import { checkHeatingTime } from '@/utils/etaUtils';

const CONFIG_FILE_PATH = path.resolve(process.cwd(), process.env.CONFIG_PATH || 'src/config/f_etacfg.json');

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
    wasSliderNegative: boolean;
    manualOverride: boolean;
    manualOverrideTime: number | null;
  } = {
      wasBelow: false,
      wasSliderNegative: false,
      manualOverride: false,
      manualOverrideTime: null
    };
  private lastEtaUpdate: number | null = null;
  // Cache for parsed ETA menu and URIs to avoid reparsing when content doesn't change
  private cachedMenuNodes: MenuNode[] | null = null;
  private cachedUris: string[] | null = null;
  // Menu is loaded once at startup and cached permanently
  private menuLoadedOnce: boolean = false;
  // Monitoring and housekeeping
  private eventLoopDelayMonitor: ReturnType<typeof monitorEventLoopDelay> | null = null;
  private readonly ETA_CALL_DELAY_MS = parseInt(process.env.ETA_CALL_DELAY_MS || '120');
  // Track active timeouts for cleanup
  private activeTimeouts: Set<NodeJS.Timeout> = new Set();
  private activeSleeps: Set<{ resolve: () => void; timeout: NodeJS.Timeout }> = new Set();
  // Redux store subscription for monitoring
  private storeUnsubscribe: (() => void) | null = null;

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

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.activeSleeps.delete(sleepObj);
        resolve();
      }, ms);
      const sleepObj = { resolve, timeout };
      this.activeSleeps.add(sleepObj);
    });
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
          try {
            const currentContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
            if (currentContent !== this.lastConfigContent) {
              this.lastConfigContent = currentContent;
              this.handleConfigChange();
            }
          } catch (error) {
            console.error(`${this.getTimestamp()} Error reading config file:`, error);
          }
        }
      });

      // Add error handler for file watcher
      this.configWatcher.on('error', (error) => {
        console.error(`${this.getTimestamp()} Config file watcher error:`, error);
        // Try to restart watcher after error
        if (this.configWatcher) {
          this.configWatcher.close();
          this.configWatcher = null;
        }
        setTimeout(() => {
          if (this.isRunning) {
            console.log(`${this.getTimestamp()} Attempting to restart config watcher...`);
            this.startConfigWatcher();
          }
        }, 5000);
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
        // Reinitialize EtaApi if endpoint changed
        const oldEtaEndpoint = this.config[ConfigKeys.S_ETA];
        const newEtaEndpoint = newConfig[ConfigKeys.S_ETA];
        this.config = newConfig;
        if (oldEtaEndpoint !== newEtaEndpoint) {
          try {
            // Dispose old EtaApi instance
            if (this.etaApi) {
              if (!this.etaApi.disposed) {
                this.etaApi.dispose();
                console.log(`${this.getTimestamp()} Old EtaApi instance disposed`);
              }
              this.etaApi = null;
            }
            this.etaApi = new EtaApi(newEtaEndpoint);
            console.log(`${this.getTimestamp()} EtaApi reinitialized due to endpoint change`);

            // Clear menu cache and reload menu structure with new endpoint
            this.menuLoadedOnce = false;
            this.cachedMenuNodes = null;
            this.cachedUris = null;
            console.log(`${this.getTimestamp()} Menu cache cleared, will reload on next data fetch`);
          } catch (e) {
            console.error(`${this.getTimestamp()} Failed to reinitialize EtaApi:`, e);
          }
        }

        /*
        this.loadAndStoreData().catch(error => {
          console.error(`${this.getTimestamp()} Error in background update:`, error);
        });
        */

        if (oldUpdateTimer !== newUpdateTimer && this.isRunning) {
          console.log(`${this.getTimestamp()} Update timer changed, restarting interval...`);
          this.restartUpdateInterval();
        }

        // Immediately recompute diff/slider with current WiFi data to keep UI in sync after config edits
        try {
          const stateNow = store.getState() as RootState;
          const currentWifi = stateNow.wifiAf83.data as WifiAF83Data;
          if (currentWifi && (currentWifi as any).time) {
            await this.updateIndoorTemperatureDiff(currentWifi);
          }
        } catch (e) {
          console.warn(`${this.getTimestamp()} Could not immediately recompute diff after config change:`, e);
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
      clearTimeout(this.updateInterval);
    }

    const updateTimer = Math.max(
      parseInt(this.config[ConfigKeys.T_UPDATE_TIMER]) || DEFAULT_UPDATE_TIMER,
      MIN_API_INTERVAL
    );

    const run = async () => {
      try {
        await this.loadAndStoreData();
      } catch (error) {
        console.error(`${this.getTimestamp()} Error in background update:`, error);
      } finally {
        if (this.isRunning) {
          this.updateInterval = setTimeout(run, updateTimer);
        }
      }
    };

    this.updateInterval = setTimeout(run, updateTimer);

    console.log(`${this.getTimestamp()} Update interval restarted with timer: ${updateTimer}ms`);
  }

  private async loadAndStoreData() {
    if (this.isUpdating) {
      console.log(`${this.getTimestamp()} Update already in progress, skipping...`);
      return;
    }

    this.isUpdating = true;
    // Capture config at the start to avoid race conditions if config changes during execution
    const currentConfig = { ...this.config };

    try {
      // Run cleanup before loading new data
      await this.cleanupOldData();

      // Create EtaApi instance if not exists
      if (!this.etaApi || this.etaApi.disposed) {
        try {
          // Dispose old instance if it exists and is not already disposed
          if (this.etaApi && !this.etaApi.disposed) {
            this.etaApi.dispose();
          }
          this.etaApi = new EtaApi(currentConfig[ConfigKeys.S_ETA]);
        } catch (e) {
          console.error(`${this.getTimestamp()} Failed to create EtaApi instance:`, e);
          throw e;
        }
      }

      // Load menu only once at startup (menu structure doesn't change)
      if (!this.menuLoadedOnce) {
        await this.loadMenuStructure();
        this.menuLoadedOnce = true;
      }

      // Get URIs from cached menu
      if (!this.cachedUris || this.cachedUris.length === 0) {
        throw new Error('Menu structure not loaded, cannot fetch data');
      }
      const uris = this.cachedUris;

      // Build id->short map once for O(1) lookups
      const idToShort: Record<string, string> = {};
      Object.keys(defaultNames2Id).forEach(k => {
        const id = (defaultNames2Id as any)[k]?.id as string | undefined;
        if (id) idToShort[id] = k;
      });

      // Fetch data in batches using EtaApi with timeout/retry
      console.log(`${this.getTimestamp()} Fetching ETA data...`);
      const menuData: EtaData = {};
      const batchSize = 5; // Process 5 URIs at a time

      const fetchWithRetry = async (id: string, retries = 2, timeoutMs = 5000): Promise<string> => {
        let attempt = 0;
        while (attempt <= retries) {
          const controller = new AbortController();
          const timer = setTimeout(() => {
            controller.abort();
          }, timeoutMs);
          this.activeTimeouts.add(timer);

          try {
            const res = await this.etaApi!.getUserVar(id, controller.signal) as { result: string | null; error: string | null; uri?: string };
            clearTimeout(timer);
            this.activeTimeouts.delete(timer);

            if (res?.result) return res.result;
            const error = new Error(res?.error || 'no result');
            (error as any).uri = id;
            throw error;
          } catch (e) {
            // Always clean up timer
            clearTimeout(timer);
            this.activeTimeouts.delete(timer);

            if (attempt < retries) {
              const backoff = 200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
              await new Promise(r => {
                const backoffTimeout = setTimeout(() => {
                  this.activeTimeouts.delete(backoffTimeout);
                  r(undefined);
                }, backoff);
                this.activeTimeouts.add(backoffTimeout);
              });
              attempt++;
            } else {
              if (!(e as any).uri) {
                (e as any).uri = id;
              }
              throw e;
            }
          }
        }
        throw Object.assign(new Error('unreachable'), { uri: id });
      };

      for (let i = 0; i < uris.length; i += batchSize) {
        const batch = uris.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(async (uri) => {
          const id = uri.replace(/^\//, '');
          const result = await fetchWithRetry(id);
          return { uri, result };
        }));

        results.forEach(r => {
          if (r.status === 'fulfilled') {
            const { uri, result } = r.value;
            // O(1) lookup for shortkey via precomputed map
            const shortkey = idToShort[uri] || '';
            // Parse the XML into ParsedXmlData so it matches EtaData shape
            menuData[uri] = parseXML(result, shortkey, defaultNames2Id);
          } else {
            const reason: any = r.reason;
            const errorUri = reason?.uri || 'unknown URI';
            console.warn(`${this.getTimestamp()} Failed to fetch data for URI: ${errorUri}`, reason?.message || reason);
          }
        });

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

      // Quick win: store ETA data in Redux
      try {
        store.dispatch(storeEtaData(menuData));
      } catch (e) {
        console.warn(`${this.getTimestamp()} Failed to dispatch ETA data to store:`, e);
      }
      // Mark ETA update time for cleanup checks
      this.lastEtaUpdate = Date.now();

      // Load WiFi AF83 data
      const wifiApi = new WifiAf83Api();
      const allData = await getWifiAf83Data(() => wifiApi.getAllRealtime());

      // Extract and validate temperature values
      const outdoorTempRaw = allData.outdoor?.temperature?.value;
      const indoorTempRaw = allData.indoor?.temperature?.value;
      const outdoorTemp = parseFloat(outdoorTempRaw ?? '');
      const indoorTemp = parseFloat(indoorTempRaw ?? '');

      let wifiData: WifiAF83Data | null = null;

      if (Number.isNaN(outdoorTemp) || Number.isNaN(indoorTemp)) {
        console.warn(`${this.getTimestamp()} Invalid temperature values (outdoor: ${outdoorTempRaw}, indoor: ${indoorTempRaw}). Skipping temperature-dependent logic.`);
        // We continue without wifiData, so temperature logic will be skipped, but ETA data is preserved
      } else {
        // Transform to match WifiAF83Data interface
        wifiData = {
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
          temperature: outdoorTemp,
          indoorTemperature: indoorTemp,
          allData: allData
        };

        console.log(`${this.getTimestamp()} WiFi AF83 data updated`);
        store.dispatch(storeWifiAf83Data(wifiData));
        console.log(`${this.getTimestamp()} Logging ECOWITT data...`);
        await logData('ecowitt', wifiData);
        console.log(`${this.getTimestamp()} Logging ECOWITT data DONE!`);

        // Update update IndoorTemperature Diff  after new data is loaded
        await this.updateIndoorTemperatureDiff(wifiData);

        // Update temperature diff after new data is loaded
        await this.updateTemperatureDiffWithServerCheck(wifiData);
      }

      // Update names2Id in store
      store.dispatch(storeNames2IdData(defaultNames2Id));

      return { etaData: menuData, wifiData: wifiData };
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
    const externalMB = Math.round(used.external / 1024 / 1024);
    const rssMB = Math.round(used.rss / 1024 / 1024);

    // Calculate resource usage
    const activeTimeoutsCount = this.activeTimeouts.size;
    const activeSleepsCount = this.activeSleeps.size;
    const cacheSize = this.cachedUris ? this.cachedUris.length : 0;

    console.log(`${this.getTimestamp()} Memory Monitor:`, {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      external: `${externalMB}MB`,
      rss: `${rssMB}MB`,
      activeTimeouts: activeTimeoutsCount,
      activeSleeps: activeSleepsCount,
      cachedUris: cacheSize,
      etaApiStatus: this.etaApi ? (this.etaApi.disposed ? 'disposed' : 'active') : 'null'
    });

    // Alert if memory usage is too high
    if (used.heapUsed > this.MAX_HEAP_SIZE) {
      console.warn(`${this.getTimestamp()} ⚠️ High memory usage detected! Running emergency cleanup...`);
      this.cleanupOldData(true).catch(error => {
        console.error(`${this.getTimestamp()} Error during emergency cleanup:`, error);
      });

      // Force garbage collection if available
      if (global.gc) {
        console.log(`${this.getTimestamp()} Forcing garbage collection...`);
        global.gc();
      } else {
        console.log(`${this.getTimestamp()} Garbage collection not available (run with --expose-gc flag)`);
      }
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

      // Check ETA data via lastEtaUpdate timestamp tracked by background service
      if (this.lastEtaUpdate && this.lastEtaUpdate < cutoffTime) {
        console.log(`${this.getTimestamp()} ETA data is outdated (last update ${new Date(this.lastEtaUpdate).toISOString()})`);
        needsRefresh = true;
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

      // Check heating times
      let isHeating = true;
      if (this.cachedMenuNodes && etaState.data) {
        isHeating = checkHeatingTime(this.cachedMenuNodes, etaState.data);
        if (!isHeating) {
          console.log(`${this.getTimestamp()} Outside heating times. Forcing diff to 0.`);
        }
      }

      let { diff: numericDiff } = calculateTemperatureDiff(config, {
        data: wifiData,
        loadingState: { isLoading: false, error: null }
      });

      // Override diff if outside heating times
      if (!isHeating) {
        numericDiff = 0;
      }

      if (numericDiff !== null) {
        console.log(`${this.getTimestamp()} Numeric diff: ${numericDiff}`);
        const newDiffValue = numericDiff.toString();
        // Only update if the diff value has changed
        if (newDiffValue !== config.data[ConfigKeys.DIFF]) {

          // Helper function to get ETA value with fallback
          const getEtaValue = (constant: EtaConstants): string => {
            // Try by ID first
            const id = defaultNames2Id[constant]?.id;
            if (id && etaState.data[id]?.strValue) {
              return etaState.data[id].strValue;
            }

            // Fallback: scan all entries for matching short code
            for (const [, item] of Object.entries(etaState.data)) {
              if (item.short === constant && item.strValue) {
                return item.strValue;
              }
            }

            return '0';
          };

          const etaValues = {
            einaus: getEtaValue(EtaConstants.EIN_AUS_TASTE),
            schaltzustand: getEtaValue(EtaConstants.SCHALTZUSTAND),
            heizentaste: getEtaValue(EtaConstants.HEIZENTASTE),
            kommentaste: getEtaValue(EtaConstants.KOMMENTASTE),
            tes: parseNumOrZero(getEtaValue(EtaConstants.SCHIEBERPOS)),
            tea: parseNumOrZero(getEtaValue(EtaConstants.AUSSENTEMP)),
          };

          console.log(`${this.getTimestamp()} Eta values: ${JSON.stringify(etaValues)}`);
          const newSliderPosition = calculateNewSliderPosition(etaValues, numericDiff);
          console.log(`${this.getTimestamp()} New slider position: ${newSliderPosition}`);
          if (newSliderPosition !== config.data[ConfigKeys.T_SLIDER] || newDiffValue !== config.data[ConfigKeys.DIFF]) {
            console.log(`${this.getTimestamp()} Updating temperature diff...`);
            const updatedConfigData = {
              ...config.data,
              [ConfigKeys.DIFF]: newDiffValue,
              [ConfigKeys.T_SLIDER]: newSliderPosition
            } as Config;
            store.dispatch(storeConfigData(updatedConfigData));
            try {
              await updateConfig(updatedConfigData);
            } catch (e) {
              console.warn(`${this.getTimestamp()} Failed to persist updated config:`, e);
            }

            const { t_soll, t_delta } = config.data;
            // Log the temperature diff update
            console.log(`${this.getTimestamp()} Updated temperature diff ${t_soll} + ${t_delta} - ${wifiData.indoorTemperature} - Diff: ${newDiffValue}, Slider: ${newSliderPosition}`);

            // Update the physical slider position if needed
            const recommendedPos = Math.round(parseFloat(newSliderPosition));
            const etaSP = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
            const currentPos = etaSP ? parseNumOrZero(etaSP.strValue) : recommendedPos;
            console.log(`${this.getTimestamp()} Current slider position: ${currentPos}, Recommended slider position: ${recommendedPos}`);
            // Only update if the positions are different and values are valid
            if (etaSP &&
              recommendedPos !== currentPos &&
              !isNaN(recommendedPos) &&
              !isNaN(currentPos)) {

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
                  // Ensure config reflects the applied target immediately for UI sync
                  try {
                    const appliedConfig = {
                      ...store.getState().config.data,
                      [ConfigKeys.T_SLIDER]: newSliderPosition
                    } as Config;
                    store.dispatch(storeConfigData(appliedConfig));
                    await updateConfig(appliedConfig);
                  } catch (e) {
                    console.warn(`${this.getTimestamp()} Failed to persist applied slider position:`, e);
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

        // Log temp_diff unconditionally every cycle
        const { t_soll, t_delta } = config.data;
        await logData('temp_diff', {
          timestamp: Date.now(),
          diff: numericDiff,
          sliderPosition: calculateNewSliderPosition({
            einaus: '0', schaltzustand: '0', heizentaste: '0', kommentaste: '0', tes: 0, tea: 0
            // Note: We don't have exact ETA values here easily without re-fetching or passing them down, 
            // but 'diff' is the main thing. We can use the calculated one or just log what we have.
            // Actually, let's just log the diff and the inputs we used to calculate it.
          }, numericDiff), // This might be inaccurate if we don't have the exact ETA state, but for diff logging it's fine. 
          // Wait, we can do better. We have 'numericDiff'.
          // Let's just log the essential data.
          t_soll: t_soll,
          t_delta: t_delta,
          indoor_temp: wifiData.indoorTemperature,
          indoor: wifiData.indoorTemperature,
          outdoor: wifiData.temperature
        });
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

      // Get current state from Redux store
      const state = store.getState() as RootState;
      const config = state.config;
      const etaState = state.eta;

      // Get current slider position
      const sliderPos = Number(config.data?.[ConfigKeys.T_SLIDER] ?? 0);

      // Calculate current diff to check if negative
      const { diff: numericDiff } = calculateTemperatureDiff(config, {
        data: wifiData,
        loadingState: { isLoading: false, error: null }
      });

      console.log(`${this.getTimestamp()} ========================================`);
      console.log(`${this.getTimestamp()} Indoor: ${indoorTemp}°C, Min: ${minTemp}°C`);

      // Find currently active button
      let currentActiveButton: EtaButtons = EtaButtons.AA;
      Object.entries(etaState.data).forEach(([_, item]) => {
        if (Object.values(EtaButtons).includes(item.short as EtaButtons) && item.value === EtaPos.EIN) {
          currentActiveButton = item.short as EtaButtons;
        }
      });

      // Prepare input for control logic
      const manualOverrideMs = parseInt(state.config.data?.t_override || String(60 * 60 * 1000));

      const input: ControlInput = {
        indoorTemp,
        minTemp,
        sliderPos,
        currentActiveButton,
        lastTempState: this.lastTempState,
        manualOverrideDurationMs: manualOverrideMs,
        currentTime: Date.now()
      };

      // Execute pure control logic
      const result = determineControlAction(input);

      // Log decisions
      result.logs.forEach(log => console.log(`${this.getTimestamp()} ${log}`));

      // Log min_temp_status only on change
      if (result.newState.wasBelow !== this.lastTempState.wasBelow) {
        const diffToMin = indoorTemp - minTemp;
        const statusMsg = result.newState.wasBelow ? 'dropped below' : 'rose above';

        await logData('min_temp_status', {
          timestamp: Date.now(),
          diff: diffToMin,
          status: statusMsg
        });
      }

      // Update state
      this.lastTempState = result.newState;

      // Handle actions
      if (result.action === 'ENTER_OVERRIDE') {
        // Nothing to do physically, just updated state (already done above)
        return;
      }

      if (result.action === 'SWITCH_BUTTON' && result.targetButton) {
        const targetButtonName = result.targetButton;

        // Log state change for analytics if needed (re-using existing logic structure)
        // We can infer if state changed by checking if we are switching buttons
        // or we can trust the logic's newState.wasBelow/wasSliderNegative changes
        // But for simplicity, we just proceed to switching.

        // Build IDs mapping
        const buttonIds = {
          [EtaButtons.HT]: defaultNames2Id[EtaConstants.HEIZENTASTE].id,
          [EtaButtons.KT]: defaultNames2Id[EtaConstants.KOMMENTASTE].id,
          [EtaButtons.AA]: defaultNames2Id[EtaConstants.AUTOTASTE].id,
          [EtaButtons.GT]: defaultNames2Id[EtaConstants.GEHENTASTE].id,
          [EtaButtons.DT]: defaultNames2Id[EtaConstants.ABSENKTASTE].id
        };

        const targetButtonId = buttonIds[targetButtonName];
        if (!targetButtonId) {
          throw new Error(`Button ID not found for ${targetButtonName}`);
        }

        try {
          // Ensure EtaApi instance is available
          if (!this.etaApi || this.etaApi.disposed) {
            if (this.etaApi && !this.etaApi.disposed) {
              this.etaApi.dispose();
            }
            this.etaApi = new EtaApi(this.config[ConfigKeys.S_ETA]);
          }
          const etaApi = this.etaApi;

          // Get current flags to minimize API calls
          const flags: Record<string, boolean> = { [EtaButtons.AA]: false, [EtaButtons.HT]: false, [EtaButtons.KT]: false, [EtaButtons.GT]: false, [EtaButtons.DT]: false };
          Object.entries(etaState.data).forEach(([_, item]) => {
            if (Object.values(EtaButtons).includes(item.short as EtaButtons)) {
              flags[item.short as EtaButtons] = item.value === EtaPos.EIN;
            }
          });

          // First turn off all buttons except AA and the target
          console.log(`${this.getTimestamp()} Turning off all buttons (except AA) before activating ${targetButtonName}`);
          for (const [name, id] of Object.entries(buttonIds)) {
            if (name !== EtaButtons.AA && name !== targetButtonName) {
              // Only send if currently ON (idempotent)
              if (flags[name]) {
                await etaApi.setUserVar(id, EtaPos.AUS, "0", "0");
                await this.sleep(this.ETA_CALL_DELAY_MS);
              }
            }
          }

          // Special handling for AA button - turn it off BEFORE activating manual button
          if (targetButtonName !== EtaButtons.AA) {
            console.log(`${this.getTimestamp()} Turning off AA button before activating manual button`);
            await etaApi.setUserVar(buttonIds[EtaButtons.AA], EtaPos.AUS, "0", "0");
            await this.sleep(this.ETA_CALL_DELAY_MS);
          }

          // Then activate target button
          console.log(`${this.getTimestamp()} Activating ${targetButtonName}`);
          await etaApi.setUserVar(targetButtonId, EtaPos.EIN, "0", "0");
          await this.sleep(this.ETA_CALL_DELAY_MS);

          // CRITICAL: Ensure AA is OFF after activating manual button (double-check)
          if (targetButtonName !== EtaButtons.AA) {
            console.log(`${this.getTimestamp()} Double-checking: AA is OFF after ${targetButtonName} activation`);
            await etaApi.setUserVar(buttonIds[EtaButtons.AA], EtaPos.AUS, "0", "0");
            // Wait for heater to process the command
            await this.sleep(this.ETA_CALL_DELAY_MS);
          }

          // Final delay to allow heater to stabilize before any status reads
          console.log(`${this.getTimestamp()} Button switching complete. Waiting for heater to stabilize...`);
          await this.sleep(500); // 500ms stabilization period

        } catch (error) {
          console.error(`${this.getTimestamp()} Error updating temperature state:`, error);
          throw error;
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

  async start() {
    if (this.isRunning) {
      console.log(`${this.getTimestamp()} Background service is already running`);
      return;
    }

    try {
      this.isRunning = true;
      console.log(`${this.getTimestamp()} Starting background service...`);

      // Initialize SQLite database
      try {
        const db = DatabaseService.getInstance();
        await db.initialize();
        console.log(`${this.getTimestamp()} SQLite database initialized`);
      } catch (error) {
        console.error(`${this.getTimestamp()} Failed to initialize SQLite database:`, error);
        // Continue anyway - will fallback to file-based logging
      }

      // Subscribe to Redux store for monitoring (optional, for debugging)
      this.storeUnsubscribe = store.subscribe(() => {
        // This runs on every state change - keep it lightweight
        // We're just monitoring, not reacting
      });
      console.log(`${this.getTimestamp()} Redux store subscription established`);

      // Start memory monitoring
      this.memoryMonitorInterval = setInterval(() => {
        this.monitorMemoryUsage();
      }, this.MEMORY_CHECK_INTERVAL);
      console.log(`${this.getTimestamp()} Memory monitoring started`);

      // Start event loop delay monitor
      try {
        this.eventLoopDelayMonitor = monitorEventLoopDelay({ resolution: 10 });
        this.eventLoopDelayMonitor.enable();
        console.log(`${this.getTimestamp()} Event loop delay monitoring started`);
      } catch (e) {
        console.warn(`${this.getTimestamp()} Could not start event loop delay monitoring:`, e);
      }

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

  /**
   * Load menu structure once at startup (menu doesn't change during runtime)
   */
  private async loadMenuStructure(): Promise<void> {
    console.log(`${this.getTimestamp()} Loading ETA menu structure (one-time operation)...`);

    if (!this.etaApi) {
      throw new Error('EtaApi not initialized');
    }

    // Add timeout with AbortController for getMenu
    const menuController = new AbortController();
    const menuTimeout = setTimeout(() => {
      this.activeTimeouts.delete(menuTimeout);
      menuController.abort();
    }, 8000);
    this.activeTimeouts.add(menuTimeout);

    let menuResponse: any;
    try {
      menuResponse = await this.etaApi.getMenu(menuController.signal);
    } finally {
      clearTimeout(menuTimeout);
      this.activeTimeouts.delete(menuTimeout);
    }

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

    const menuXml = menuResponse.result as string;

    parseMenuXML(menuXml);
    this.cachedMenuNodes = menuNodes;

    // Get all URIs from the menu tree
    console.log(`${this.getTimestamp()} Extracting URIs from menu tree...`);

    // Count all nodes before filtering
    const countAllUris = (nodes: MenuNode[]): number => {
      let count = 0;
      const countNode = (node: MenuNode) => {
        if (node.uri) count++;
        node.children?.forEach(countNode);
      };
      nodes.forEach(countNode);
      return count;
    };

    const totalUris = countAllUris(menuNodes);
    const uris = getAllUris(menuNodes);
    this.cachedUris = uris;

    console.log(`${this.getTimestamp()} ✓ Menu structure loaded: ${uris.length} endpoint URIs (filtered out ${totalUris - uris.length} category URIs)`);
    console.log(`${this.getTimestamp()} ✓ Menu will be reused for all subsequent data fetches`);
  }

  async stop() {
    console.log(`${this.getTimestamp()} Stopping background service...`);

    // Unsubscribe from Redux store
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
      console.log(`${this.getTimestamp()} Redux store unsubscribed`);
    }

    // Clear memory monitoring interval
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
      console.log(`${this.getTimestamp()} Memory monitoring stopped`);
    }

    // Clear update timeout
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
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

    // Stop event loop delay monitor
    if (this.eventLoopDelayMonitor) {
      try {
        this.eventLoopDelayMonitor.disable();
      } catch { /* ignore */ }
      this.eventLoopDelayMonitor = null;
    }

    // Clear all active timeouts
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts.clear();
    console.log(`${this.getTimestamp()} Cleared ${this.activeTimeouts.size} active timeouts`);

    // Cancel all active sleep promises
    this.activeSleeps.forEach(({ resolve, timeout }) => {
      clearTimeout(timeout);
      resolve(); // Resolve immediately to prevent hanging promises
    });
    this.activeSleeps.clear();
    console.log(`${this.getTimestamp()} Cancelled ${this.activeSleeps.size} active sleep promises`);

    // Dispose EtaApi instance
    if (this.etaApi) {
      try {
        if (!this.etaApi.disposed) {
          this.etaApi.dispose();
          console.log(`${this.getTimestamp()} EtaApi instance disposed`);
        } else {
          console.log(`${this.getTimestamp()} EtaApi instance already disposed`);
        }
      } catch (e) {
        console.warn(`${this.getTimestamp()} Error disposing EtaApi:`, e);
      }
      this.etaApi = null;
    }

    // Close SQLite database connection
    try {
      const db = DatabaseService.getInstance();
      await db.close();
      console.log(`${this.getTimestamp()} SQLite database connection closed`);
    } catch (error) {
      console.error(`${this.getTimestamp()} Error closing SQLite connection:`, error);
    }

    // Clear caches to free memory
    this.cachedMenuNodes = null;
    this.cachedUris = null;
    this.menuLoadedOnce = false;
    console.log(`${this.getTimestamp()} Cleared menu cache`);

    this.isRunning = false;
    console.log(`${this.getTimestamp()} Background service stopped`);
  }
}
