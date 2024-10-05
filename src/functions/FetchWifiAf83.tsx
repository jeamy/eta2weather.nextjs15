import { F_WIFIAF83 } from "./Config";

class WifiAF83Service {
    private wifiaf83: any;
    private data: any = {};
    private config: { [key: string]: string } = {};

    constructor(config: { [key: string]: string }) {
        this.config = config;
    }

    async fetchWifiAF83Data(): Promise<{ [key: string]: any }> {
        const result = await this.wifiaf83.fGetRealtime();
        if (result.error !== false) {
            console.error("Fetching WifiAF83 failed.", result.error);
            return { error: result.error } as { [key: string]: any };
        }

        this.data = JSON.parse(result.result);
        const formattedDateTime = new Date(this.data.time).toLocaleString('de-DE', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        this.data.datestring = formattedDateTime;

        const jwifiaf89 = JSON.stringify(this.data);
        await this.writeData(this.config[F_WIFIAF83], jwifiaf89);

        return this.data;
    }

    private writeData(file: string, data: string): void {
        const fs = require('fs');
        fs.writeFileSync(file, data);
    }
}

export default WifiAF83Service;