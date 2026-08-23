import { DatabaseService } from './sqliteService';
import { getLogExtension, isLogType, LOG_TABLES, LogType } from '../logTypes';
import { extractWeatherChannels } from '@/utils/weatherData';

export const TIME_RANGES = ['24h', '7d', '30d', '1m'] as const;
export type TimeRange = typeof TIME_RANGES[number];

export function isTimeRange(value: string): value is TimeRange {
    return TIME_RANGES.includes(value as TimeRange);
}

export function getTimeRangeHours(range: TimeRange, now: Date = new Date()): number {
    switch (range) {
        case '24h': return 24;
        case '7d': return 7 * 24;
        case '30d': return 30 * 24;
        case '1m': {
            const originalDay = now.getDate();
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setDate(1);
            oneMonthAgo.setMonth(now.getMonth() - 1);
            const lastDayOfTargetMonth = new Date(
                oneMonthAgo.getFullYear(),
                oneMonthAgo.getMonth() + 1,
                0,
            ).getDate();
            oneMonthAgo.setDate(Math.min(originalDay, lastDayOfTargetMonth));
            return Math.floor((now.getTime() - oneMonthAgo.getTime()) / (1000 * 60 * 60));
        }
    }
}
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

    async getWeatherData(range: TimeRange, now: Date = new Date()): Promise<any[]> {
        await this.ensureInitialized();
        const hours = getTimeRangeHours(range, now);
        const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const endDate = new Date(now);

        // Determine which years we need to query
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        const yearsToQuery: number[] = [];
        const availableYears = new Set(this.db.getAllAvailableYears());

        for (let year = startYear; year <= endYear; year++) {
            yearsToQuery.push(year);
        }

        // Sample data for larger ranges to keep response size manageable
        const sampleRate = this.getSampleRate(range);

        const allRows: any[] = [];

        // Query each year's DB
        for (const year of yearsToQuery) {
            if (!availableYears.has(year)) continue;
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
                throw new Error(`Error querying weather data for year ${year}`, { cause: error });
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
                channels: extractWeatherChannels(data)
            };
        });
    }

    private getSampleRate(range: TimeRange): number {
        switch (range) {
            case '24h': return 1;
            case '7d': return 3;
            case '30d': return 6;
            case '1m': return 6;
            default: return 1;
        }
    }

    async getLogsAsFilePaths(type: string, limit = 1000): Promise<string[]> {
        await this.ensureInitialized();

        if (!isLogType(type)) {
            console.warn(`getLogsAsFilePaths not supported for type: ${type}`);
            return [];
        }
        const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 5000));

        const table = LOG_TABLES[type];
        const allRows: Array<{ id: number; timestamp: string }> = [];
        const years = this.db.getAllAvailableYears();

        for (const year of years) {
            if (allRows.length >= safeLimit) break;
            try {
                const yearDb = this.db.getDbForYear(year);
                const alias = year === this.db.getCurrentYear() ? '' : `db_${year}.`;
                const remaining = safeLimit - allRows.length;
                const rows = yearDb.prepare(`
                    SELECT id, timestamp
                    FROM ${alias}${table}
                    ORDER BY timestamp DESC
                    LIMIT ?
                `).all(remaining) as Array<{ id: number; timestamp: string }>;
                allRows.push(...rows);
            } catch (error) {
                console.error(`Error querying logs for year ${year}:`, error);
            }
        }

        allRows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        return allRows.map(row => {
            const date = new Date(row.timestamp);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${type}/${year}/${month}/${day}/${hour}-${minute}-${second}-id${row.id}.${getLogExtension(type)}`;
        });
    }

    async getLogEntry(type: LogType, year: number, id: number): Promise<Record<string, unknown> | null> {
        await this.ensureInitialized();
        if (!Number.isInteger(id) || id < 1 || !Number.isInteger(year) || year < 2000 || year > 2100) {
            return null;
        }

        const yearDb = this.db.getDbForYear(year);
        const alias = year === this.db.getCurrentYear() ? '' : `db_${year}.`;
        return (yearDb.prepare(`SELECT * FROM ${alias}${LOG_TABLES[type]} WHERE id = ?`).get(id) as Record<string, unknown> | undefined) ?? null;
    }

}
