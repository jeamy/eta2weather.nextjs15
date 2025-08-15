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

    constructor(server: string = DEFAULT_SERVER) {
        this.server = server;
    }

    setServer(server: string): void {
        this.server = server;
    }

    private async fetchApi(endpoint: string, method: 'GET' | 'POST', body?: Record<string, string>): Promise<ApiResponse> {
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
            };
            
            try {
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

    public async getUserVar(id: string): Promise<ApiResponse> {
        return this.fetchApi(`user/var/${id}`, 'GET');
    }

    public async setUserVar(id: string, value: string, begin: string, end: string): Promise<ApiResponse> {
        console.log(`Setting user var for ID: ${id} with value: ${value}, begin: ${begin}, end: ${end}`);
        return this.fetchApi(`user/var/${id}`, 'POST', {
            value: value,
            begin: begin,
            end: end
        });
    }

    public async getMenu(): Promise<ApiResponse> {
        return this.fetchApi('user/menu', 'GET');
    }
}
