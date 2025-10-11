import { DatabaseService } from './sqliteService';

export type TimeRange = '24h' | '7d' | '1m';

export class DatabaseHelpers {
    private db: DatabaseService;
    private static initPromise: Promise<void> | null = null;

    constructor() {
        this.db = DatabaseService.getInstance();
    }

    private async ensureInitialized(): Promise<void> {
        if (!DatabaseHelpers.initPromise) {
            DatabaseHelpers.initPromise = this.db.initialize().catch(err => {
                // Reset promise on error so it can be retried
                DatabaseHelpers.initPromise = null;
                throw err;
            });
        }
        await DatabaseHelpers.initPromise;
    }

    async getWeatherData(range: TimeRange): Promise<any[]> {
        await this.ensureInitialized();
        const hours = this.getRangeHours(range);
        const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
        const endDate = new Date();
        
        // Determine which years we need to query
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        const yearsToQuery: number[] = [];
        
        for (let year = startYear; year <= endYear; year++) {
            yearsToQuery.push(year);
        }
        
        // Sample data for larger ranges to keep response size manageable
        const sampleRate = this.getSampleRate(range);
        
        const allRows: any[] = [];
        
        // Query each year's DB
        for (const year of yearsToQuery) {
            try {
                const yearDb = this.db.getDbForYear(year);
                const alias = year === this.db.getCurrentYear() ? '' : `db_${year}.`;
                
                const query = `
                    SELECT timestamp, data 
                    FROM ${alias}ecowitt_logs 
                    WHERE timestamp >= ? AND timestamp <= ?
                    ${sampleRate > 1 ? `AND id % ${sampleRate} = 0` : ''}
                    ORDER BY timestamp
                `;
                
                const rows = yearDb.prepare(query).all(startDate.toISOString(), endDate.toISOString());
                // Avoid stack overflow with large arrays
                for (const row of rows) {
                    allRows.push(row);
                }
            } catch (error) {
                console.error(`Error querying year ${year}:`, error);
            }
        }
        
        // Sort combined results
        allRows.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
        
        return allRows.map((row: any) => {
            const data = JSON.parse(row.data);
            return {
                timestamp: row.timestamp,
                temperature: data.outdoor?.temperature?.value,
                pressure: data.pressure?.relative?.value,
                humidity: data.outdoor?.humidity?.value,
                indoor: {
                    temperature: data.indoor?.temperature?.value,
                    humidity: data.indoor?.humidity?.value
                },
                channels: this.extractChannels(data)
            };
        });
    }

    private extractChannels(data: any): Record<string, { temperature: number; humidity: number }> {
        const channels: Record<string, { temperature: number; humidity: number }> = {};
        [1, 2, 3, 5, 6, 7, 8].forEach(idx => {
            const ch = data[`temp_and_humidity_ch${idx}`];
            const t = ch?.temperature?.value;
            const h = ch?.humidity?.value;
            const tf = t !== undefined && t !== null && t !== '' ? parseFloat(String(t)) : NaN;
            const hf = h !== undefined && h !== null && h !== '' ? parseFloat(String(h)) : NaN;
            if (Number.isFinite(tf) && Number.isFinite(hf)) {
                channels[`ch${idx}`] = { temperature: tf, humidity: hf };
            }
        });
        return channels;
    }

    private getRangeHours(range: TimeRange): number {
        switch (range) {
            case '24h': return 24;
            case '7d': return 7 * 24;
            case '1m': {
                // Calculate actual month duration dynamically
                const now = new Date();
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(now.getMonth() - 1);
                return Math.floor((now.getTime() - oneMonthAgo.getTime()) / (1000 * 60 * 60));
            }
            default: return 24;
        }
    }

    private getSampleRate(range: TimeRange): number {
        switch (range) {
            case '24h': return 1;
            case '7d': return 3;
            case '1m': return 6;
            default: return 1;
        }
    }

    async getLogsAsFilePaths(type: string): Promise<string[]> {
        await this.ensureInitialized();
        
        // Only ecowitt, eta, and config logs have year/month/day/hour/minute structure
        const validTypes = ['ecowitt', 'eta', 'config'];
        if (!validTypes.includes(type)) {
            console.warn(`getLogsAsFilePaths not supported for type: ${type}`);
            return [];
        }
        
        const table = `${type}_logs`;
        const allRows: any[] = [];
        const years = this.db.getAllAvailableYears();
        
        for (const year of years) {
            try {
                const yearDb = this.db.getDbForYear(year);
                const alias = year === this.db.getCurrentYear() ? '' : `db_${year}.`;
                
                const query = `
                    SELECT year, month, day, hour, minute 
                    FROM ${alias}${table} 
                    ORDER BY year DESC, month DESC, day DESC, hour DESC, minute DESC
                `;
                
                const rows = yearDb.prepare(query).all();
                // Avoid stack overflow with large arrays
                for (const row of rows) {
                    allRows.push(row);
                }
            } catch (error) {
                console.error(`Error querying logs for year ${year}:`, error);
            }
        }
        
        // Sort combined results
        allRows.sort((a: any, b: any) => {
            if (a.year !== b.year) return b.year - a.year;
            if (a.month !== b.month) return b.month - a.month;
            if (a.day !== b.day) return b.day - a.day;
            if (a.hour !== b.hour) return b.hour - a.hour;
            return b.minute - a.minute;
        });
        
        return allRows.map((row: any) => {
            const ext = type === 'config' ? 'json' : 'xml';
            const month = String(row.month).padStart(2, '0');
            const day = String(row.day).padStart(2, '0');
            const hour = String(row.hour).padStart(2, '0');
            const minute = String(row.minute).padStart(2, '0');
            return `${type}/${row.year}/${month}/${day}/${hour}-${minute}.${ext}`;
        });
    }

    async count(table: string): Promise<number> {
        await this.ensureInitialized();
        const years = this.db.getAllAvailableYears();
        let totalCount = 0;
        
        for (const year of years) {
            try {
                const yearDb = this.db.getDbForYear(year);
                const alias = year === this.db.getCurrentYear() ? '' : `db_${year}.`;
                const result = yearDb.prepare(`SELECT COUNT(*) as count FROM ${alias}${table}`).get() as any;
                totalCount += result?.count || 0;
            } catch (error) {
                console.error(`Error counting for year ${year}:`, error);
            }
        }
        
        return totalCount;
    }

    async getAllTimestamps(table: string): Promise<string[]> {
        await this.ensureInitialized();
        const years = this.db.getAllAvailableYears();
        const allTimestamps: string[] = [];
        
        for (const year of years) {
            try {
                const yearDb = this.db.getDbForYear(year);
                const alias = year === this.db.getCurrentYear() ? '' : `db_${year}.`;
                const rows = yearDb.prepare(`SELECT timestamp FROM ${alias}${table} ORDER BY timestamp`).all();
                // Avoid stack overflow with large arrays
                for (const row of rows) {
                    allTimestamps.push((row as any).timestamp);
                }
            } catch (error) {
                console.error(`Error getting timestamps for year ${year}:`, error);
            }
        }
        
        return allTimestamps.sort();
    }
}
