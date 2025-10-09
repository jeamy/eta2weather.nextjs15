import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : path.join(process.cwd(), 'db');

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
        return path.join(DB_DIR, `eta2weather_${year}.db`);
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

        // Initialize schema if new DB
        if (!dbExists) {
            this.initializeSchema();
            console.log(`[${new Date().toISOString()}] Created new DB for year ${year}: ${dbPath}`);
        }
    }

    attachYear(year: number): void {
        if (!this.currentDb) throw new Error('Database not initialized');
        if (this.attachedDbs.has(year)) return; // Already attached

        const dbPath = this.getDbPath(year);
        if (!fs.existsSync(dbPath)) {
            console.warn(`DB for year ${year} does not exist: ${dbPath}`);
            return;
        }

        const alias = `db_${year}`;
        this.currentDb.exec(`ATTACH DATABASE '${dbPath}' AS ${alias}`);
        this.attachedDbs.set(year, alias);
        console.log(`[${new Date().toISOString()}] Attached DB for year ${year} as ${alias}`);
    }

    detachYear(year: number): void {
        if (!this.currentDb) return;
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
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(year, month, day, hour, minute)
            );

            CREATE TABLE IF NOT EXISTS temp_diff_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL UNIQUE,
                diff REAL NOT NULL,
                slider_position INTEGER,
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
            (timestamp, year, month, day, hour, minute, data) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(now.toISOString(), now.getFullYear(), now.getMonth() + 1,
              now.getDate(), now.getHours(), now.getMinutes(), JSON.stringify(data));
    }

    async insertTempDiffLog(data: { diff: number; sliderPosition?: number; t_soll?: number; t_delta?: number; indoor_temp?: number }): Promise<void> {
        const now = new Date();
        await this.switchToYear(now.getFullYear());
        if (!this.currentDb) throw new Error('Database not initialized');
        
        this.currentDb.prepare(`INSERT INTO temp_diff_logs 
            (timestamp, diff, slider_position, t_soll, t_delta, indoor_temp) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(now.toISOString(), data.diff, data.sliderPosition, data.t_soll, data.t_delta, data.indoor_temp);
    }

    async insertMinTempStatusLog(data: { diff: number; status: string }): Promise<void> {
        const now = new Date();
        await this.switchToYear(now.getFullYear());
        if (!this.currentDb) throw new Error('Database not initialized');
        
        this.currentDb.prepare(`INSERT INTO min_temp_status_logs (timestamp, diff, status) VALUES (?, ?, ?)`
        ).run(now.toISOString(), data.diff, data.status);
    }

    getDbForYear(year: number): Database.Database {
        if (!this.currentDb) throw new Error('Database not initialized');
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
                years.push(parseInt(match[1]));
            }
        }
        
        return years.sort((a, b) => b - a); // Newest first
    }

    getDatabase(): Database.Database {
        if (!this.currentDb) throw new Error('Database not initialized');
        return this.currentDb;
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
