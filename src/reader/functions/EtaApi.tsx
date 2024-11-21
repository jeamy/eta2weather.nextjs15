import { env } from 'process';

const DEFAULT_SERVER = `${env.DEFAULT_SERVER || '192.168.8.100:8080'}`;

// Neuer Typ für die Rückgabe
type ApiResponse = {
    result: string | null;
    error: string | null;
};

export class EtaApi {
    private server: string;

    constructor(server: string = DEFAULT_SERVER) {
        console.log(`Using server: ${server}`);
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
            
            console.log(`Sending ${method} request to ${url}`);
            console.log(`Body: ${body ? JSON.stringify(body) : 'null'}`);
            
            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: body ? new URLSearchParams(body).toString() : undefined,
            });
            
            if (!response.ok) {
                throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            }
            
            const result = await response.text();
//            console.log(`Response body: ${result}`);
            return { result, error: null };
        } catch (error) {
            console.error('API Error:', error);
            return { 
                result: null, 
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    public async getUserVar(id: string): Promise<ApiResponse> {
//        console.log(`Getting user var for ID: ${id}`);
        return this.fetchApi(`user/var/${id}`, 'GET');
    }

    public async setUserVar(id: string, value: string, begin: string, end: string): Promise<ApiResponse> {
//        console.log(`Setting user var for ID: ${id} with value: ${value}, begin: ${begin}, end: ${end}`);
        return this.fetchApi(`user/var/${id}`, 'POST', {
            value: value,
            begin: begin,
            end: end
        });
    }

    public async getMenu(): Promise<ApiResponse> {
        return this.fetchApi('/user/menu', 'GET');
    }
}
