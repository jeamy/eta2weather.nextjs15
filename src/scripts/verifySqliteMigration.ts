#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../lib/database/sqliteService';

const LOG_BASE_DIR = path.join(process.cwd(), 'public', 'log');

async function countFiles(dir: string, extension: string): Promise<number> {
    if (!fs.existsSync(dir)) {
        return 0;
    }

    let count = 0;
    const walk = (currentDir: string) => {
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(currentDir, item.name);
            if (item.isDirectory()) {
                walk(fullPath);
            } else if (item.name.endsWith(extension)) {
                count++;
            }
        }
    };

    walk(dir);
    return count;
}

async function verifyCount(type: string, table: string, extension: string, db: DatabaseService): Promise<boolean> {
    const dir = path.join(LOG_BASE_DIR, type);
    const fileCount = await countFiles(dir, extension);
    const database = db.getDatabase();
    const dbCount = database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
    
    const match = fileCount === dbCount.count;
    const status = match ? '✓' : '✗';
    
    console.log(`${status} ${type.padEnd(15)} Files: ${fileCount.toString().padStart(6)}, DB: ${dbCount.count.toString().padStart(6)} ${match ? 'MATCH' : 'MISMATCH'}`);
    
    return match;
}

async function verifyTimestampCoverage(type: string, table: string, extension: string, db: DatabaseService, sampleSize: number = 10): Promise<boolean> {
    const dir = path.join(LOG_BASE_DIR, type);
    if (!fs.existsSync(dir)) {
        console.log(`  ⚠ Directory does not exist: ${dir}`);
        return true;
    }

    // Get random sample of files
    const files: string[] = [];
    const walk = (currentDir: string) => {
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(currentDir, item.name);
            if (item.isDirectory()) {
                walk(fullPath);
            } else if (item.name.endsWith(extension)) {
                files.push(fullPath);
            }
        }
    };
    walk(dir);

    if (files.length === 0) {
        console.log(`  ⚠ No files found in ${dir}`);
        return true;
    }

    const sample = files.sort(() => Math.random() - 0.5).slice(0, Math.min(sampleSize, files.length));
    let matches = 0;
    let mismatches = 0;

    for (const file of sample) {
        const parts = file.split(path.sep);
        const fileName = parts[parts.length - 1];
        const day = parts[parts.length - 2];
        const month = parts[parts.length - 3];
        const year = parts[parts.length - 4];
        
        const [time] = fileName.split('.');
        const [hour, minute] = time.split('-');

        const database = db.getDatabase();
        const result = database.prepare(`
            SELECT COUNT(*) as count FROM ${table}
            WHERE year = ? AND month = ? AND day = ? AND hour = ? AND minute = ?
        `).get(parseInt(year), parseInt(month), parseInt(day), parseInt(hour), parseInt(minute)) as any;

        if (result.count > 0) {
            matches++;
        } else {
            mismatches++;
            console.log(`  ✗ Missing: ${year}-${month}-${day} ${hour}:${minute}`);
        }
    }

    const allMatch = mismatches === 0;
    console.log(`  ${allMatch ? '✓' : '✗'} Spot-check: ${matches}/${sample.length} timestamps found in DB`);
    return allMatch;
}

async function verifyDataIntegrity(db: DatabaseService): Promise<void> {
    console.log('\n=== Data Integrity Checks ===');
    
    // Check for NULL data
    const tables = ['ecowitt_logs', 'eta_logs', 'config_logs'];
    const database = db.getDatabase();
    for (const table of tables) {
        const result = database.prepare(`
            SELECT COUNT(*) as count FROM ${table} WHERE data IS NULL OR data = ''
        `).get() as any;
        
        if (result.count > 0) {
            console.log(`  ✗ ${table}: ${result.count} records with NULL/empty data`);
        } else {
            console.log(`  ✓ ${table}: No NULL/empty data`);
        }
    }

    // Check for duplicate timestamps
    for (const table of tables) {
        const result = database.prepare(`
            SELECT year, month, day, hour, minute, COUNT(*) as count
            FROM ${table}
            GROUP BY year, month, day, hour, minute
            HAVING count > 1
        `).all() as any[];
        
        if (result.length > 0) {
            console.log(`  ✗ ${table}: ${result.length} duplicate timestamps`);
        } else {
            console.log(`  ✓ ${table}: No duplicate timestamps`);
        }
    }
}

async function showDatabaseStats(db: DatabaseService): Promise<void> {
    console.log('\n=== Database Statistics ===');
    
    const tables = [
        { name: 'ecowitt_logs', label: 'Ecowitt' },
        { name: 'eta_logs', label: 'ETA' },
        { name: 'config_logs', label: 'Config' },
        { name: 'temp_diff_logs', label: 'Temp Diff' },
        { name: 'min_temp_status_logs', label: 'Min Temp' }
    ];

    const database = db.getDatabase();
    for (const table of tables) {
        const count = database.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as any;
        const oldest = database.prepare(`SELECT MIN(timestamp) as ts FROM ${table.name}`).get() as any;
        const newest = database.prepare(`SELECT MAX(timestamp) as ts FROM ${table.name}`).get() as any;
        
        console.log(`${table.label.padEnd(12)}: ${count.count.toString().padStart(7)} records`);
        if (oldest.ts && newest.ts) {
            console.log(`               ${oldest.ts.substring(0, 10)} → ${newest.ts.substring(0, 10)}`);
        }
    }

    // Database file size
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'db', 'eta2weather.db');
    if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`\nDatabase size: ${sizeMB} MB`);
    }

    // Get migration metadata
    const migrationMeta = database.prepare(`
        SELECT value FROM migration_metadata WHERE key = 'last_migration'
    `).get() as any;
    
    if (migrationMeta) {
        console.log(`Last migration: ${migrationMeta.value}`);
    }
}

async function main() {
    console.log('=== SQLite Migration Verification ===\n');
    console.log(`Verification time: ${new Date().toISOString()}\n`);

    try {
        // Initialize database
        const db = DatabaseService.getInstance();
        await db.initialize();

        // Count verification
        console.log('=== Count Verification ===');
        const ecowittMatch = await verifyCount('ecowitt', 'ecowitt_logs', '.xml', db);
        const etaMatch = await verifyCount('eta', 'eta_logs', '.xml', db);
        const configMatch = await verifyCount('config', 'config_logs', '.json', db);
        
        // Note: temp_diff and min_temp_status don't use year/month/day structure
        const tempDiffDir = path.join(LOG_BASE_DIR, 'temp_diff');
        const tempDiffFileCount = await countFiles(tempDiffDir, '.xml');
        const database = db.getDatabase();
        const tempDiffDbCount = database.prepare(`SELECT COUNT(*) as count FROM temp_diff_logs`).get() as any;
        const tempDiffMatch = tempDiffFileCount === tempDiffDbCount.count;
        console.log(`${tempDiffMatch ? '✓' : '✗'} temp_diff      Files: ${tempDiffFileCount.toString().padStart(6)}, DB: ${tempDiffDbCount.count.toString().padStart(6)} ${tempDiffMatch ? 'MATCH' : 'MISMATCH'}`);
        
        const minTempDir = path.join(LOG_BASE_DIR, 'min_temp_status');
        const minTempFileCount = await countFiles(minTempDir, '.xml');
        const minTempDbCount = database.prepare(`SELECT COUNT(*) as count FROM min_temp_status_logs`).get() as any;
        const minTempMatch = minTempFileCount === minTempDbCount.count;
        console.log(`${minTempMatch ? '✓' : '✗'} min_temp_status Files: ${minTempFileCount.toString().padStart(6)}, DB: ${minTempDbCount.count.toString().padStart(6)} ${minTempMatch ? 'MATCH' : 'MISMATCH'}`);

        // Timestamp coverage (spot-check)
        console.log('\n=== Timestamp Coverage (Spot-Check) ===');
        const ecowittCoverage = await verifyTimestampCoverage('ecowitt', 'ecowitt_logs', '.xml', db, 20);
        const etaCoverage = await verifyTimestampCoverage('eta', 'eta_logs', '.xml', db, 20);
        const configCoverage = await verifyTimestampCoverage('config', 'config_logs', '.json', db, 10);

        // Data integrity
        await verifyDataIntegrity(db);

        // Statistics
        await showDatabaseStats(db);

        // Final verdict
        const allChecks = ecowittMatch && etaMatch && configMatch && tempDiffMatch && minTempMatch &&
                         ecowittCoverage && etaCoverage && configCoverage;

        console.log('\n=== Verification Result ===');
        if (allChecks) {
            console.log('✓ All checks passed! Migration is successful.');
        } else {
            console.log('✗ Some checks failed. Please review the migration.');
            process.exit(1);
        }

        await db.close();
    } catch (error) {
        console.error('\n✗ Verification failed:', error);
        process.exit(1);
    }
}

main();
