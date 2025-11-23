import { env } from 'process';

const DEFAULT_SERVER = `${env.DEFAULT_SERVER || '192.168.8.100:8080'}`;
const DEBUG = process.env.NODE_ENV === 'development';

// Response type
type ApiResponse = {
    result: string | null;
    error: string | null;
    uri?: string;
};

export class EtaApi {
    private server: string;
    private abortControllers: Set<AbortController> = new Set();
    private isDisposed: boolean = false;

    constructor(server: string = DEFAULT_SERVER) {
        this.server = this.normalizeServer(server);
    }

    setServer(server: string): void {
        this.server = this.normalizeServer(server);
    }

    /**
     * Normalize server address by removing protocol prefix
     */
    private normalizeServer(server: string): string {
        return server.replace(/^https?:\/\//, '');
    }

    /**
     * Build full URL from endpoint
     */
    private buildUrl(endpoint: string): string {
        const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `http://${this.server}${formattedEndpoint}`;
    }

    private async fetchApi(
        endpoint: string,
        method: 'GET' | 'POST',
        body?: Record<string, string>,
        signal?: AbortSignal
    ): Promise<ApiResponse> {
        if (this.isDisposed) {
            return { result: null, error: 'EtaApi instance has been disposed', uri: endpoint };
        }

        const url = this.buildUrl(endpoint);

        // Create internal abort controller for tracking
        const internalController = new AbortController();
        this.abortControllers.add(internalController);

        // Link external signal to internal controller
        if (signal) {
            signal.addEventListener('abort', () => {
                internalController.abort();
            }, { once: true });
        }

        try {
            if (DEBUG && body) {
                console.log(`[EtaApi] ${method} ${url}`, body);
            }

            const fetchOptions: RequestInit = {
                method,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: body ? new URLSearchParams(body).toString() : undefined,
                signal: internalController.signal,
            };

            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                return {
                    result: null,
                    error: `HTTP error! Status: ${response.status}`,
                    uri: url
                };
            }

            const result = await response.text();
            return { result, error: null };

        } catch (error) {
            // Check if it was an abort
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    result: null,
                    error: 'Request aborted',
                    uri: url
                };
            }

            // Network or other errors
            if (DEBUG) {
                console.warn(`[EtaApi] Error for ${url}:`, error);
            }

            return {
                result: null,
                error: error instanceof Error ? error.message : 'Unknown error',
                uri: url
            };
        } finally {
            // Always cleanup
            this.abortControllers.delete(internalController);
        }
    }

    public async getUserVar(id: string, signal?: AbortSignal): Promise<ApiResponse> {
        return this.fetchApi(`user/var/${id}`, 'GET', undefined, signal);
    }

    public async setUserVar(
        id: string,
        value: string,
        begin: string,
        end: string,
        signal?: AbortSignal
    ): Promise<ApiResponse> {
        if (DEBUG) {
            console.log(`[EtaApi] Setting var ${id}: value=${value}, begin=${begin}, end=${end}`);
        }

        return this.fetchApi(`user/var/${id}`, 'POST', {
            value,
            begin,
            end
        }, signal);
    }

    public async getMenu(signal?: AbortSignal): Promise<ApiResponse> {
        return this.fetchApi('user/menu', 'GET', undefined, signal);
    }

    /**
     * Dispose method to clean up resources and abort pending requests
     */
    public dispose(): void {
        if (this.isDisposed) {
            return;
        }

        const pendingCount = this.abortControllers.size;

        if (DEBUG && pendingCount > 0) {
            console.log(`[EtaApi] Disposing instance, aborting ${pendingCount} pending requests`);
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
            console.log('[EtaApi] Instance disposed successfully');
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
