import { env } from 'process';

const DEFAULT_SERVER = env.DEFAULT_SERVER || '192.168.1.100';

// Neuer Typ für die Rückgabe
type ApiResponse = {
    result: string | null;
    error: string | null;
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
        const url = `http://${this.server}${endpoint}`;
        console.log(`Sending ${method} request to ${url}`);
        try {
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
            return { result, error: null };
        } catch (error) {
            return { 
                result: null, 
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    public async getUserVar(id: string): Promise<ApiResponse> {
        return this.fetchApi(`/user/var/${id}`, 'GET');
    }

    public async setUserVar(id: string, value: string, begin: string, end: string): Promise<ApiResponse> {
        return this.fetchApi(`/user/var/${id}`, 'POST', { value, begin, end });
    }
}
