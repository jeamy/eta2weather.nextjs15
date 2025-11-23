import EcoCon from "../../../eco";

const DEBUG = process.env.NODE_ENV === 'development';
const DEFAULT_TIMEOUT_MS = 8000;

type ApiResponse<T = any> = {
  data: T | null;
  error: string | null;
};

export class WifiAf83Api {
  private readonly ecoCon: EcoCon;
  private readonly baseUrl: string;
  private readonly params: URLSearchParams;
  private readonly all: URLSearchParams;
  private abortControllers: Set<AbortController> = new Set();
  private isDisposed: boolean = false;

  constructor() {
    this.ecoCon = EcoCon.getInstance();
    const config = this.ecoCon.getConfig();

    this.baseUrl = `https://${config.server}/api/v3/device/real_time`;

    // Common params for both endpoints
    const commonParams = {
      mac: config.mac,
      api_key: config.apiKey,
      application_key: config.applicationKey,
      method: 'device/real_time',
      temp_unitid: '1',
      pressure_unitid: '3',
      wind_speed_unitid: '7',
      rainfall_unitid: '12',
      solar_irradiance_unitid: '16'
    };

    this.params = new URLSearchParams({
      ...commonParams,
      call_back: 'indoor.temperature,outdoor.temperature',
    });

    this.all = new URLSearchParams({
      ...commonParams,
      call_back: 'all',
    });
  }

  /**
   * Fetch with timeout and abort signal support
   */
  private async fetchWithTimeout(
    url: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    externalSignal?: AbortSignal
  ): Promise<Response> {
    if (this.isDisposed) {
      throw new Error('WifiAf83Api instance has been disposed');
    }

    const controller = new AbortController();
    this.abortControllers.add(controller);

    // Setup timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Link external signal
    const onAbort = () => controller.abort();
    if (externalSignal) {
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onAbort);
      }
      this.abortControllers.delete(controller);
    }
  }

  /**
   * Parse JSON response with error handling
   */
  private parseJsonResponse<T = any>(text: string, url: string): T {
    if (!text || text.trim() === '') {
      throw new Error('Empty response from WiFi API');
    }

    try {
      return JSON.parse(text);
    } catch (parseError) {
      if (DEBUG) {
        console.error('[WifiAf83Api] JSON parse error. Response text:', text.substring(0, 200));
      }
      throw new Error(`Invalid JSON response from ${url}: ${parseError}`);
    }
  }

  /**
   * Generic fetch method to reduce code duplication
   */
  private async fetchData<T = any>(
    params: URLSearchParams,
    signal?: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}?${params}`;

    try {
      const response = await this.fetchWithTimeout(url, timeoutMs, signal);

      if (!response.ok) {
        return {
          data: null,
          error: `HTTP error! Status: ${response.status}`
        };
      }

      const text = await response.text();
      const data = this.parseJsonResponse<T>(text, url);

      if (DEBUG) {
        console.log('[WifiAf83Api] Fetched data successfully');
      }

      return { data, error: null };

    } catch (error) {
      // Check if it was an abort
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          data: null,
          error: 'Request aborted'
        };
      }

      // Log error in debug mode
      if (DEBUG) {
        console.error('[WifiAf83Api] Error fetching data:', error);
      }

      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all realtime data
   */
  public async getAllRealtime(
    signal?: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<any> {
    const result = await this.fetchData(this.all, signal, timeoutMs);

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  }

  /**
   * Get filtered realtime data (indoor/outdoor temperature)
   */
  public async getRealtime(
    signal?: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<any> {
    const result = await this.fetchData(this.params, signal, timeoutMs);

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  }

  /**
   * Dispose method to clean up resources
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    const pendingCount = this.abortControllers.size;

    if (DEBUG && pendingCount > 0) {
      console.log(`[WifiAf83Api] Disposing instance, aborting ${pendingCount} pending requests`);
    }

    // Abort all pending requests
    this.abortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch {
        // Ignore abort errors
      }
    });

    this.abortControllers.clear();
    this.isDisposed = true;

    if (DEBUG) {
      console.log('[WifiAf83Api] Instance disposed successfully');
    }
  }

  /**
   * Check if instance is disposed
   */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Get number of pending requests
   */
  public get pendingRequests(): number {
    return this.abortControllers.size;
  }
}
