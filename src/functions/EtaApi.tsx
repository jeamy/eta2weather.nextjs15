const defaultServer = "192.168.8.100:8080";

class EtaApi {
    private server: string;

    constructor(server: string = defaultServer) {
        this.server = server;
    }

    setServer(server: string): void {
        this.server = server;
    }

    async fGetEtaApi(url: string): Promise<{ result: string | false; error: string | false }> {
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            const result = await response.text();
            return { 
                result, 
                error: false 
            };
        } catch (error) {
            return { 
                result: false, 
                error: (error as Error).message
            };
        }
    }

    async fPostEtaApi(url: string, value: string, begin: string, end: string): Promise<{ result: string | false; error: string | false }> {
        try {
            const data = new URLSearchParams({ value, begin, end });
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: data.toString(),
            });
            const result = await response.text();
            return { 
                result, 
                error: false 
            };
        } catch (error) {
            return { 
                result: false, 
                error: (error as Error).message
            };
        }
    }

    public async fGetUserVar(id: string): Promise<{ result: string | false; error: string | false }> {
        const url = `http://${this.server}/user/var/${id}`;
        return this.fGetEtaApi(url);
    }

    public async fSetUserVar(id: string, value: string, begin: string, end: string): Promise<{ result: string | false; error: string | false }> {
        const url = `http://${this.server}/user/var/${id}`;
        return this.fPostEtaApi(url, value, begin, end);
    }
}

export default EtaApi;