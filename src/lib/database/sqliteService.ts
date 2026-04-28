import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : path.join(process.cwd(), 'db');
const SCHEMA_VERSION = '2';

export class DatabaseService {
    private static instance: DatabaseService;
    private currentDb: Database.Database | null = null;
    public currentYear: number | null = null;
    private attachedDbs: Map<number, string> = new Map(); // year -> alias
    private isInitialized = false;

    private constructor() {}

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private getDbPath(year: number): string {
        if (!this.isValidYear(year)) {
            throw new Error(`Invalid database year: ${year}`);
        }
        return path.join(DB_DIR, `eta2weather_${year}.db`);
    }

    private isValidYear(year: number): boolean {
        return Number.isInteger(year) && year >= 2000 && year <= 2100;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }

        // Initialize current year DB
        const currentYear = new Date().getFullYear();
        await this.switchToYear(currentYear);
        
        this.isInitialized = true;
        console.log(`[${new Date().toISOString()}] SQLite initialized with year-based partitioning in ${DB_DIR}`);
    }

    private async switchToYear(year: number): Promise<void> {
        if (this.currentYear === year && this.currentDb) {
            return; // Already on correct year
        }

        const dbPath = this.getDbPath(year);
        const dbExists = fs.existsSync(dbPath);

        // Close current DB if switching
        if (this.currentDb && this.currentYear !== year) {
            this.currentDb.close();
        }

        this.currentDb = new Database(dbPath);
        this.currentYear = year;

        // Configure DB
        this.currentDb.pragma('journal_mode = WAL');
        this.currentDb.pragma('synchronous = NORMAL');
        this.currentDb.pragma('page_size = 8192');
        this.currentDb.pragma('cache_size = -64000');
        this.currentDb.pragma('mmap_size = 268435456');

        // Always initialize/migrate schema. Existing DBs may have been created by older versions.
        this.initializeSchema();
        if (!dbExists) {
            console.log(`[${new Date().toISOString()}] Created new DB for year ${year}: ${dbPath}`);
        }
    }

    attachYear(year: number): void {
        if (!this.currentDb) throw new Error('Database not initialized');
        if (!this.isValidYear(year)) throw new Error(`Invalid database year: ${year}`);
        if (this.attachedDbs.has(year)) return; // Already attached

        const dbPath = this.getDbPath(year);
        if (!fs.existsSync(dbPath)) {
            console.warn(`DB for year ${year} does not exist: ${dbPath}`);
            return;
        }

        const alias = `db_${year}`;
        const escapedDbPath = dbPath.replace(/'/g, "''");
        this.currentDb.exec(`ATTACH DATABASE '${escapedDbPath}' AS ${alias}`);
        this.attachedDbs.set(year, alias);
        console.log(`[${new Date().toISOString()}] Attached DB for year ${year} as ${alias}`);
    }

    detachYear(year: number): void {
        if (!this.currentDb) return;
        if (!this.isValidYear(year)) throw new Error(`Invalid database year: ${year}`);
        const alias = this.attachedDbs.get(year);
        if (!alias) return;

        this.currentDb.exec(`DETACH DATABASE ${alias}`);
        this.attachedDbs.delete(year);
        console.log(`[${new Date().toISOString()}] Detached DB for year ${year}`);
    }

    detachAllYears(): void {
        for (const year of this.attachedDbs.keys()) {
            this.detachYear(year);
        }
    }

    private initializeSchema(): void {
        if (!this.currentDb) throw new Error('Database not connected');

        this.currentDb.exec(`
            CREATE TABLE IF NOT EXISTS ecowitt_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                hour INTEGER NOT NULL,
                minute INTEGER NOT NULL,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(year, month, day, hour, minute)
            );
            CREATE INDEX IF NOT EXISTS idx_ecowitt_timestamp ON ecowitt_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_ecowitt_date ON ecowitt_logs(year, month, day);

            CREATE TABLE IF NOT EXISTS eta_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                hour INTEGER NOT NULL,
                minute INTEGER NOT NULL,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(year, month, day, hour, minute)
            );
            CREATE INDEX IF NOT EXISTS idx_eta_timestamp ON eta_logs(timestamp);

            CREATE TABLE IF NOT EXISTS config_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                hour INTEGER NOT NULL,
                minute INTEGER NOT NULL,
                second INTEGER NOT NULL DEFAULT 0,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(year, month, day, hour, minute, second)
            );

            CREATE TABLE IF NOT EXISTS temp_diff_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL UNIQUE,
                diff REAL NOT NULL,
                slider_position REAL,
                t_soll REAL,
                t_delta REAL,
                indoor_temp REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_temp_diff_timestamp ON temp_diff_logs(timestamp);

            CREATE TABLE IF NOT EXISTS min_temp_status_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL UNIQUE,
                diff REAL NOT NULL,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_min_temp_status_timestamp ON min_temp_status_logs(timestamp);

            CREATE TABLE IF NOT EXISTS migration_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        this.migrateConfigLogs();
        this.migrateTempDiffLogs();
        this.currentDb.prepare(`
            INSERT OR REPLACE INTO migration_metadata (key, value, updated_at)
            VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
        `).run(SCHEMA_VERSION);
    }

    private getTableColumns(table: string): Array<{ name: string; type: string }> {
        if (!this.currentDb) throw new Error('Database not connected');
        return this.currentDb.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; type: string }>;
    }

    private migrateConfigLogs(): void {
        if (!this.currentDb) throw new Error('Database not connected');
        const columns = this.getTableColumns('config_logs');
        if (!columns.length || columns.some(column => column.name === 'second')) {
            return;
        }

        this.currentDb.exec(`
            ALTER TABLE config_logs RENAME TO config_logs_old;
            CREATE TABLE config_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                hour INTEGER NOT NULL,
                minute INTEGER NOT NULL,
                second INTEGER NOT NULL DEFAULT 0,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(year, month, day, hour, minute, second)
            );
            INSERT OR REPLACE INTO config_logs (id, timestamp, year, month, day, hour, minute, second, data, created_at)
            SELECT id, timestamp, year, month, day, hour, minute,
                   CAST(strftime('%S', timestamp) AS INTEGER),
                   data, created_at
            FROM config_logs_old;
            DROP TABLE config_logs_old;
        `);
    }

    private migrateTempDiffLogs(): void {
        if (!this.currentDb) throw new Error('Database not connected');
        const sliderColumn = this.getTableColumns('temp_diff_logs').find(column => column.name === 'slider_position');
        if (!sliderColumn || sliderColumn.type.toUpperCase() === 'REAL') {
            return;
        }

        this.currentDb.exec(`
            ALTER TABLE temp_diff_logs RENAME TO temp_diff_logs_old;
            CREATE TABLE temp_diff_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL UNIQUE,
                diff REAL NOT NULL,
                slider_position REAL,
                t_soll REAL,
                t_delta REAL,
                indoor_temp REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT OR REPLACE INTO temp_diff_logs (id, timestamp, diff, slider_position, t_soll, t_delta, indoor_temp, created_at)
            SELECT id, timestamp, diff, slider_position, t_soll, t_delta, indoor_temp, created_at
            FROM temp_diff_logs_old;
            DROP TABLE temp_diff_logs_old;
            CREATE INDEX IF NOT EXISTS idx_temp_diff_timestamp ON temp_diff_logs(timestamp);
        `);
    }

    async insertEcowittLog(data: any): Promise<void> {
        const now = new Date();
        await this.switchToYear(now.getFullYear());
        if (!this.currentDb) throw new Error('Database not initialized');
        
        this.currentDb.prepare(`INSERT OR REPLACE INTO ecowitt_logs 
            (timestamp, year, month, day, hour, minute, data) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(now.toISOString(), now.getFullYear(), now.getMonth() + 1, 
              now.getDate(), now.getHours(), now.getMinutes(), JSON.stringify(data));
    }

    async insertEtaLog(data: any): Promise<void> {
        const now = new Date();
        await this.switchToYear(now.getFullYear());
        if (!this.currentDb) throw new Error('Database not initialized');
        
        this.currentDb.prepare(`INSERT OR REPLACE INTO eta_logs 
            (timestamp, year, month, day, hour, minute, data) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(now.toISOString(), now.getFullYear(), now.getMonth() + 1,
              now.getDate(), now.getHours(), now.getMinutes(), JSON.stringify(data));
    }

    async insertConfigLog(data: any): Promise<void> {
        const now = new Date();
        await this.switchToYear(now.getFullYear());
        if (!this.currentDb) throw new Error('Database not initialized');
        
        this.currentDb.prepare(`INSERT OR REPLACE INTO config_logs 
            (timestamp, year, month, day, hour, minute, second, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(now.toISOString(), now.getFullYear(), now.getMonth() + 1,
              now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), JSON.stringify(data));
    }

    async insertTempDiffLog(data: { diff: number; sliderPosition?: number; t_soll?: number; t_delta?: number; indoor_temp?: number }): Promise<void> {
        const now = new Date();
        await this.switchToYear(now.getFullYear());
        if (!this.currentDb) throw new Error('Database not initialized');
        
        this.currentDb.prepare(`INSERT OR REPLACE INTO temp_diff_logs 
            (timestamp, diff, slider_position, t_soll, t_delta, indoor_temp) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(now.toISOString(), data.diff, data.sliderPosition, data.t_soll, data.t_delta, data.indoor_temp);
    }

    async insertMinTempStatusLog(data: { diff: number; status: string }): Promise<void> {
        const now = new Date();
        await this.switchToYear(now.getFullYear());
        if (!this.currentDb) throw new Error('Database not initialized');
        
        this.currentDb.prepare(`INSERT OR REPLACE INTO min_temp_status_logs (timestamp, diff, status) VALUES (?, ?, ?)`
        ).run(now.toISOString(), data.diff, data.status);
    }

    getCurrentYear(): number | null {
        return this.currentYear;
    }

    getDbForYear(year: number): Database.Database {
        if (!this.currentDb) throw new Error('Database not initialized');
        if (!this.isValidYear(year)) throw new Error(`Invalid database year: ${year}`);
        if (this.currentYear === year) return this.currentDb;
        
        // Attach if not already attached
        this.attachYear(year);
        return this.currentDb;
    }

    getAllAvailableYears(): number[] {
        if (!fs.existsSync(DB_DIR)) return [];
        
        const files = fs.readdirSync(DB_DIR);
        const years: number[] = [];
        
        for (const file of files) {
            const match = file.match(/^eta2weather_(\d{4})\.db$/);
            if (match) {
                years.push(parseInt(match[1], 10));
            }
        }
        
        return years.sort((a, b) => b - a); // Newest first
    }

    getDatabase(): Database.Database {
        if (!this.currentDb) throw new Error('Database not initialized');
        return this.currentDb;
    }

    async deleteOlderThan(cutoffIso: string): Promise<number> {
        await this.initialize();
        const years = this.getAllAvailableYears();
        let deleted = 0;
        const tables = ['ecowitt_logs', 'eta_logs', 'config_logs', 'temp_diff_logs', 'min_temp_status_logs'];

        for (const year of years) {
            try {
                const yearDb = this.getDbForYear(year);
                const alias = year === this.currentYear ? '' : `db_${year}.`;
                for (const table of tables) {
                    const result = yearDb.prepare(`DELETE FROM ${alias}${table} WHERE timestamp < ?`).run(cutoffIso);
                    deleted += result.changes;
                }
            } catch (error) {
                console.error(`Error deleting old rows for year ${year}:`, error);
            }
        }

        return deleted;
    }

    async close(): Promise<void> {
        this.detachAllYears();
        
        if (this.currentDb) {
            this.currentDb.close();
            this.currentDb = null;
            this.currentYear = null;
            this.isInitialized = false;
        }
    }
}
