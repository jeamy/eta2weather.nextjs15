import { env } from 'process';

const DEFAULT_SERVER = `${env.DEFAULT_SERVER || '192.168.8.100:8080'}`;

// Neuer Typ für die Rückgabe
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
        this.server = server;
    }

    setServer(server: string): void {
        this.server = server;
    }

    private async fetchApi(endpoint: string, method: 'GET' | 'POST', body?: Record<string, string>, signal?: AbortSignal): Promise<ApiResponse> {
        if (this.isDisposed) {
            return { result: null, error: 'EtaApi instance has been disposed', uri: endpoint };
        }
        
        try {
            // Ensure server doesn't start with http:// or https://
            const serverAddress = this.server.replace(/^https?:\/\//, '');
            
            // Ensure endpoint starts with a slash
            const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            
            // Construct the full URL
            const url = `http://${serverAddress}${formattedEndpoint}`;
            
            // console.log(`Sending ${method} request to ${url}`);
            if (body) {
                console.log(`Body: ${JSON.stringify(body)}`);
            }

            const fetchOptions: RequestInit = {
                method,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: body ? new URLSearchParams(body).toString() : undefined,
                signal,
            };
            
            try {
                // Track external abort controller if provided
                if (signal && signal instanceof AbortSignal) {
                    const controller = new AbortController();
                    this.abortControllers.add(controller);
                    // Clean up when signal aborts
                    signal.addEventListener('abort', () => {
                        this.abortControllers.delete(controller);
                    });
                }
                
                const response = await fetch(url, fetchOptions);
                
                if (!response.ok) {
                    return { 
                        result: null, 
                        error: `HTTP error! Status: ${response.status}`,
                        uri: url
                    };
                }
                
                const result = await response.text();
                
                // Clean up abort controller tracking
                if (signal) {
                    this.abortControllers.forEach(controller => {
                        if (controller.signal === signal) {
                            this.abortControllers.delete(controller);
                        }
                    });
                }
                
                return { result, error: null };
            } catch (fetchError) {
                // Handle network errors silently
                return { 
                    result: null, 
                    error: 'Network error - request will be retried automatically',
                    uri: url
                };
            }
        } catch (error) {
            // Log but don't throw
            console.warn(`API Error for ${endpoint}:`, error);
            const serverAddress = this.server.replace(/^https?:\/\//, '');
            const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const url = `http://${serverAddress}${formattedEndpoint}`;
            return { 
                result: null, 
                error: error instanceof Error ? error.message : String(error),
                uri: url
            };
        }
    }

    public async getUserVar(id: string, signal?: AbortSignal): Promise<ApiResponse> {
        return this.fetchApi(`user/var/${id}`, 'GET', undefined, signal);
    }

    public async setUserVar(id: string, value: string, begin: string, end: string, signal?: AbortSignal): Promise<ApiResponse> {
        console.log(`Setting user var for ID: ${id} with value: ${value}, begin: ${begin}, end: ${end}`);
        return this.fetchApi(`user/var/${id}`, 'POST', {
            value: value,
            begin: begin,
            end: end
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
        
        console.log(`[EtaApi] Disposing instance, aborting ${this.abortControllers.size} pending requests`);
        
        // Abort all pending requests
        this.abortControllers.forEach(controller => {
            try {
                controller.abort();
            } catch (e) {
                // Ignore abort errors
            }
        });
        
        this.abortControllers.clear();
        this.isDisposed = true;
        
        console.log('[EtaApi] Instance disposed successfully');
    }

    /**
     * Check if instance is disposed
     */
    public get disposed(): boolean {
        return this.isDisposed;
    }
}
