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
import { createLogger } from '@/utils/logger';
import { MenuNode } from '@/types/menu';
import { EtaPos, EtaButtons, EtaData } from '@/reader/functions/types-constants/EtaConstants';
import { logData } from '@/utils/logging';
import { getConfig, updateConfig } from '@/utils/cache';
import { getWifiAf83Data } from '@/utils/cache';
import { DatabaseService } from '@/lib/database/sqliteService';
import * as fs from 'fs';
import path from 'path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { calculateNewSliderPosition, calculateTemperatureDiff, updateSliderPosition } from '@/utils/Functions';
import { parseXML } from '@/reader/functions/EtaData';
import { parseEtaMenuXml } from '@/reader/functions/etaMenuParser';
import { parseNum, parseNumOrZero } from '@/utils/numberParser';
import { determineControlAction, ControlInput } from './controlLogic';
import { checkHeatingTime } from '@/utils/etaUtils';
import { setHeatingMode, HeatingButtonFlags } from './heatingMode';
const getRuntimeRoot = () => process.cwd();

const CONFIG_FILE_PATH = path.resolve(getRuntimeRoot(), process.env.CONFIG_PATH || 'src/config/f_etacfg.json');

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
  private readonly ETA_FULL_SCAN_INTERVAL_MS = parseInt(process.env.ETA_FULL_SCAN_INTERVAL_MS || String(60 * 60 * 1000), 10);
  private readonly logger = createLogger('BackgroundService');
  private etaApi: EtaApi | null = null;
  private lastTempState: {
    wasBelow: boolean;
    wasSliderNegative: boolean;
    manualOverride: boolean;
    manualOverrideTime: number | null;
    initialized: boolean;
  } = {
      wasBelow: false,
      wasSliderNegative: false,
      manualOverride: false,
      manualOverrideTime: null,
      initialized: false
    };
  private lastEtaUpdate: number | null = null;
  private lastFullEtaScan: number | null = null;
  // Cache for parsed ETA menu and URIs to avoid reparsing when content doesn't change
  private cachedMenuNodes: MenuNode[] | null = null;
  private cachedUris: string[] | null = null;
  // Menu is loaded once at startup and cached permanently
  private menuLoadedOnce: boolean = false;
  // Monitoring and housekeeping
  private eventLoopDelayMonitor: ReturnType<typeof monitorEventLoopDelay> | null = null;
  private readonly ETA_CALL_DELAY_MS = parseInt(process.env.ETA_CALL_DELAY_MS || '120', 10);
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
      const configData = await getConfig();
      console.log(`${this.getTimestamp()} Config loaded successfully`);
      store.dispatch(storeConfigData(configData));
      return configData;
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
        const oldUpdateTimer = parseInt(this.config[ConfigKeys.T_UPDATE_TIMER], 10) || DEFAULT_UPDATE_TIMER;
        const newUpdateTimer = parseInt(newConfig[ConfigKeys.T_UPDATE_TIMER], 10) || DEFAULT_UPDATE_TIMER;

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
            this.lastFullEtaScan = null;
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
      parseInt(this.config[ConfigKeys.T_UPDATE_TIMER], 10) || DEFAULT_UPDATE_TIMER,
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

  private shouldRunFullEtaScan(): boolean {
    if (!this.lastFullEtaScan) return true;
    if (!Number.isFinite(this.ETA_FULL_SCAN_INTERVAL_MS) || this.ETA_FULL_SCAN_INTERVAL_MS <= 0) return false;
    return Date.now() - this.lastFullEtaScan >= this.ETA_FULL_SCAN_INTERVAL_MS;
  }

  private getBackgroundEtaUris(): string[] {
    const requiredUris = new Set<string>();
    Object.values(defaultNames2Id).forEach(entry => {
      if (entry?.id) requiredUris.add(entry.id);
    });

    const addNodeTree = (node: MenuNode) => {
      if (node.uri) requiredUris.add(node.uri);
      node.children?.forEach(addNodeTree);
    };

    const walk = (nodes: MenuNode[]) => {
      for (const node of nodes) {
        if (node.name === 'Heizzeiten' || node.uri?.endsWith('/12113/0/0')) {
          addNodeTree(node);
          continue;
        }
        if (node.children) walk(node.children);
      }
    };

    if (this.cachedMenuNodes) {
      walk(this.cachedMenuNodes);
    }

    if (this.cachedUris?.length) {
      const filtered = this.cachedUris.filter(uri => requiredUris.has(uri));
      return filtered.length ? filtered : this.cachedUris;
    }

    return Array.from(requiredUris);
  }

  private async loadAndStoreData() {
    if (this.isUpdating) {
      this.logger.debug('Update already in progress, skipping');
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
      const allUris = this.cachedUris;
      const shouldFullEtaScan = this.shouldRunFullEtaScan();
      const uris = shouldFullEtaScan ? allUris : this.getBackgroundEtaUris();

      // Build id->short map once for O(1) lookups
      const idToShort: Record<string, string> = {};
      Object.keys(defaultNames2Id).forEach(k => {
        const id = (defaultNames2Id as any)[k]?.id as string | undefined;
        if (id) idToShort[id] = k;
      });

      // Fetch data in batches using EtaApi with timeout/retry
      this.logger.info(`Fetching ETA data (${shouldFullEtaScan ? 'full scan' : 'control subset'}: ${uris.length}/${allUris.length} URIs)`);
      const existingEtaData = (store.getState() as RootState).eta.data || {};
      const menuData: EtaData = shouldFullEtaScan ? {} : { ...existingEtaData };
      const batchSize = 5; // Process 5 URIs at a time
      let fetchedCount = 0;

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
            fetchedCount += 1;
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

      if (shouldFullEtaScan) {
        this.lastFullEtaScan = Date.now();
      }

      this.logger.info(`Successfully fetched ETA data for ${fetchedCount} URIs; store now has ${Object.keys(menuData).length} entries`);

      if (shouldFullEtaScan) {
        this.logger.debug('Logging ETA data');
        await logData('eta', menuData);
        this.logger.debug('Logging ETA data done');
      } else {
        this.logger.debug('Skipping ETA full-data log for control subset refresh');
      }

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
      const allData = await getWifiAf83Data(() => wifiApi.getAllRealtime())
        .finally(() => wifiApi.dispose());

      // Extract and validate temperature values
      const outdoorTempRaw = allData.outdoor?.temperature?.value;
      const indoorTempRaw = allData.indoor?.temperature?.value;
      const outdoorTemp = parseNum(outdoorTempRaw);
      const indoorTemp = parseNum(indoorTempRaw);

      let wifiData: WifiAF83Data | null = null;

      if (outdoorTemp === null || indoorTemp === null) {
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

        this.logger.debug('WiFi AF83 data updated');
        store.dispatch(storeWifiAf83Data(wifiData));
        this.logger.debug('Logging ECOWITT data');
        await logData('ecowitt', wifiData);
        this.logger.debug('Logging ECOWITT data done');

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

    this.logger.debug('Memory Monitor', {
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
      this.logger.warn('High memory usage detected; running emergency cleanup');
      this.cleanupOldData(true).catch(error => {
        this.logger.error('Error during emergency cleanup', error);
      });

      // Force garbage collection if available
      if (global.gc) {
        this.logger.info('Forcing garbage collection');
        global.gc();
      } else {
        this.logger.debug('Garbage collection not available (run with --expose-gc flag)');
      }
    }
  }

  private async cleanupOldData(emergency: boolean = false) {
    this.logger.debug(`Running data cleanup${emergency ? ' (emergency)' : ''}`);

    try {
      const state = store.getState() as RootState;
      const retentionPeriod = emergency ? this.DATA_RETENTION_PERIOD / 2 : this.DATA_RETENTION_PERIOD;
      const cutoffTime = Date.now() - retentionPeriod;

      let needsRefresh = false;

      // Check WiFi AF83 data
      const wifiData = state.wifiAf83.data;
      if (wifiData?.time && wifiData.time < cutoffTime) {
        this.logger.debug('WiFi AF83 data is outdated');
        needsRefresh = true;
      }

      // Check ETA data via lastEtaUpdate timestamp tracked by background service
      if (this.lastEtaUpdate && this.lastEtaUpdate < cutoffTime) {
        this.logger.debug(`ETA data is outdated (last update ${new Date(this.lastEtaUpdate).toISOString()})`);
        needsRefresh = true;
      }

      // If any data is outdated, refresh all data
      if (needsRefresh) {
        // Clear outdated data from store with empty data objects
        store.dispatch(storeWifiAf83Data({
          time: 0,
          datestring: '',
          temperature: 0,
          indoorTemperature: 0,
          allData: null
        }));
        store.dispatch(storeEtaData({}));
        this.lastFullEtaScan = null;
        this.logger.info('Cleared outdated data from store');
      }

      try {
        const db = DatabaseService.getInstance();
        const deletedRows = await db.deleteOlderThan(new Date(cutoffTime).toISOString());
        if (deletedRows > 0) {
          this.logger.info(`Deleted ${deletedRows} old SQLite log rows`);
        }
      } catch (error) {
        console.warn(`${this.getTimestamp()} Failed to delete old SQLite log rows:`, error);
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
        console.log(`${this.getTimestamp()} Checking heating times using cached menu and ETA data...`);
        isHeating = checkHeatingTime(this.cachedMenuNodes, etaState.data);
        console.log(`${this.getTimestamp()} Heating time check result:`, {
          isHeating,
        });
        if (!isHeating) {
          console.log(`${this.getTimestamp()} Outside heating times. Forcing diff to 0.`);
        }
      } else {
        console.log(`${this.getTimestamp()} Heating time check skipped because cachedMenuNodes or etaState.data are missing. Treating as heating allowed.`, {
          hasCachedMenuNodes: !!this.cachedMenuNodes,
          hasEtaData: !!etaState.data,
        });
      }

      let { diff: numericDiff } = calculateTemperatureDiff(config, {
        data: wifiData,
        loadingState: { isLoading: false, error: null }
      });

      let hasManualOverride = false;

      // Helper function to get ETA value with fallback
      const getEtaValue = (constant: EtaConstants): string => {
        if (!etaState.data) {
          return '0';
        }
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

      if (etaState.data) {
        const heizentasteValue = getEtaValue(EtaConstants.HEIZENTASTE);
        const kommentasteValue = getEtaValue(EtaConstants.KOMMENTASTE);
        hasManualOverride = heizentasteValue === 'Ein' || kommentasteValue === 'Ein';
      }

      // Override diff if outside heating times and no manual override
      if (!isHeating && !hasManualOverride) {
        numericDiff = 0;
      }

      if (numericDiff !== null) {
        console.log(`${this.getTimestamp()} Numeric diff: ${numericDiff}`);
        const newDiffValue = numericDiff.toString();
        const etaValues = {
          einaus: getEtaValue(EtaConstants.EIN_AUS_TASTE),
          schaltzustand: getEtaValue(EtaConstants.SCHALTZUSTAND),
          heizentaste: getEtaValue(EtaConstants.HEIZENTASTE),
          kommentaste: getEtaValue(EtaConstants.KOMMENTASTE),
          tes: parseNumOrZero(getEtaValue(EtaConstants.SCHIEBERPOS)),
          tea: parseNumOrZero(getEtaValue(EtaConstants.AUSSENTEMP)),
          vorlauftemp: parseNumOrZero(getEtaValue(EtaConstants.VORLAUFTEMP)),
        };
        const sliderPositions = calculateNewSliderPosition(etaValues, numericDiff);
        const currentConfigData = store.getState().config.data;

        console.log(`${this.getTimestamp()} Eta values: ${JSON.stringify(etaValues)}`);
        console.log(`${this.getTimestamp()} New slider position: base=${sliderPositions.base}, final=${sliderPositions.final}`);

        const configChanged =
          newDiffValue !== currentConfigData[ConfigKeys.DIFF] ||
          sliderPositions.final !== currentConfigData[ConfigKeys.T_SLIDER] ||
          sliderPositions.base !== currentConfigData[ConfigKeys.T_SLIDER_BASE];

        if (configChanged) {
          console.log(`${this.getTimestamp()} Updating temperature diff/slider config...`);
          const latestConfigData = store.getState().config.data;
          const updatedConfigData = {
            ...latestConfigData,
            [ConfigKeys.DIFF]: newDiffValue,
            [ConfigKeys.T_SLIDER]: sliderPositions.final,
            [ConfigKeys.T_SLIDER_BASE]: sliderPositions.base
          } as Config;
          store.dispatch(storeConfigData(updatedConfigData));
          try {
            await updateConfig({
              [ConfigKeys.DIFF]: newDiffValue,
              [ConfigKeys.T_SLIDER]: sliderPositions.final,
              [ConfigKeys.T_SLIDER_BASE]: sliderPositions.base
            });
          } catch (e) {
            console.warn(`${this.getTimestamp()} Failed to persist updated config:`, e);
          }

          const { t_soll, t_delta } = updatedConfigData;
          console.log(`${this.getTimestamp()} Updated temperature diff ${t_soll} + ${t_delta} - ${wifiData.indoorTemperature} - Diff: ${newDiffValue}, Slider: ${sliderPositions.base} -> ${sliderPositions.final}`);
        }

        // Update the physical slider position if needed, even if only ETA state or flow temperature changed.
        const recommendedPos = Math.round(parseFloat(sliderPositions.final));
        const etaSP = etaState.data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
        const currentPos = etaSP ? parseNumOrZero(etaSP.strValue) : recommendedPos;
        console.log(`${this.getTimestamp()} Current slider position: ${currentPos}, Recommended slider position: ${recommendedPos}`);

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

        const { t_soll, t_delta } = store.getState().config.data;
        await logData('temp_diff', {
          timestamp: Date.now(),
          diff: numericDiff,
          sliderPosition: sliderPositions.final,
          sliderPositionBase: sliderPositions.base,
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
      const manualOverrideMs = parseInt(state.config.data?.t_override || String(60 * 60 * 1000), 10);

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
          const flags: HeatingButtonFlags = { [EtaButtons.AA]: false, [EtaButtons.HT]: false, [EtaButtons.KT]: false, [EtaButtons.GT]: false, [EtaButtons.DT]: false };
          Object.entries(etaState.data).forEach(([_, item]) => {
            if (Object.values(EtaButtons).includes(item.short as EtaButtons)) {
              flags[item.short as EtaButtons] = item.value === EtaPos.EIN;
            }
          });

          await setHeatingMode({
            targetButton: targetButtonName,
            names2id: defaultNames2Id,
            etaApi,
            activeFlags: flags,
            delayMs: this.ETA_CALL_DELAY_MS,
            sleep: (ms) => this.sleep(ms),
            log: (message) => console.log(`${this.getTimestamp()} ${message}`)
          });

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

  /**
   * Immediately recomputes the temperature diff and slider position using
   * the current WiFi data in the store. Called by the config API route after
   * any config change so the frontend gets up-to-date slider/diff values
   * without waiting for the next background interval.
   * Returns the config state after recompute.
   */
  async triggerImmediateRecompute(previousConfig?: Config): Promise<void> {
    try {
      const freshConfig = await getConfig();
      const oldConfig = previousConfig ?? this.config;
      const oldUpdateTimer = parseInt(oldConfig[ConfigKeys.T_UPDATE_TIMER], 10) || DEFAULT_UPDATE_TIMER;
      const newUpdateTimer = parseInt(freshConfig[ConfigKeys.T_UPDATE_TIMER], 10) || DEFAULT_UPDATE_TIMER;
      const oldEtaEndpoint = oldConfig[ConfigKeys.S_ETA];
      const newEtaEndpoint = freshConfig[ConfigKeys.S_ETA];

      this.config = freshConfig;
      store.dispatch(storeConfigData(freshConfig));

      if (oldEtaEndpoint !== newEtaEndpoint) {
        if (this.etaApi && !this.etaApi.disposed) {
          this.etaApi.dispose();
        }
        this.etaApi = new EtaApi(newEtaEndpoint);
        this.menuLoadedOnce = false;
        this.cachedMenuNodes = null;
        this.cachedUris = null;
        this.lastFullEtaScan = null;
      }

      if (!this.etaApi || this.etaApi.disposed) {
        this.etaApi = new EtaApi(freshConfig[ConfigKeys.S_ETA]);
      }

      if (oldUpdateTimer !== newUpdateTimer && this.isRunning) {
        this.restartUpdateInterval();
      }

      const state = store.getState() as RootState;
      const wifiData = state.wifiAf83.data as WifiAF83Data;
      if (wifiData && (wifiData as any).time) {
        await this.updateIndoorTemperatureDiff(wifiData);
      }
    } catch (e) {
      console.warn(`${this.getTimestamp()} triggerImmediateRecompute failed:`, e);
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

    const menuXml = menuResponse.result as string;
    const menuNodes = parseEtaMenuXml(menuXml);
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
    const activeTimeoutsCount = this.activeTimeouts.size;
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts.clear();
    console.log(`${this.getTimestamp()} Cleared ${activeTimeoutsCount} active timeouts`);

    // Cancel all active sleep promises
    const activeSleepsCount = this.activeSleeps.size;
    this.activeSleeps.forEach(({ resolve, timeout }) => {
      clearTimeout(timeout);
      resolve(); // Resolve immediately to prevent hanging promises
    });
    this.activeSleeps.clear();
    console.log(`${this.getTimestamp()} Cancelled ${activeSleepsCount} active sleep promises`);

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
    this.lastFullEtaScan = null;
    this.menuLoadedOnce = false;
    console.log(`${this.getTimestamp()} Cleared menu cache`);

    this.isRunning = false;
    console.log(`${this.getTimestamp()} Background service stopped`);
  }
}
