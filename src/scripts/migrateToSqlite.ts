#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../lib/database/sqliteService';
import { DOMParser } from '@xmldom/xmldom';

const LOG_BASE_DIR = path.join(process.cwd(), 'public', 'log');
const BATCH_SIZE = 1000;

interface MigrationStats {
    ecowitt: { total: number; success: number; errors: number };
    eta: { total: number; success: number; errors: number };
    config: { total: number; success: number; errors: number };
    temp_diff: { total: number; success: number; errors: number };
    min_temp_status: { total: number; success: number; errors: number };
}

async function getAllFiles(dir: string, extension: string): Promise<string[]> {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
        console.log(`Directory does not exist: ${dir}`);
        return files;
    }

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
    return files;
}

function parseTimestampFromPath(filePath: string): { timestamp: Date; year: number; month: number; day: number; hour: number; minute: number } | null {
    // Extract: /public/log/{type}/{year}/{month}/{day}/{hour}-{minute}.{ext}
    const parts = filePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    const day = parts[parts.length - 2];
    const month = parts[parts.length - 3];
    const year = parts[parts.length - 4];
    
    const [time] = fileName.split('.');
    const [hour, minute] = time.split('-');
    
    if (!year || !month || !day || !hour || !minute) {
        return null;
    }

    const timestamp = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
    );

    return {
        timestamp,
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
        hour: parseInt(hour),
        minute: parseInt(minute)
    };
}

function parseXmlContent(xmlContent: string): any {
    try {
        // Sanitize XML before parsing
        let sanitized = xmlContent;
        
        // Remove BOM if present
        if (sanitized.charCodeAt(0) === 0xFEFF) {
            sanitized = sanitized.slice(1);
        }
        
        // Fix common XML errors
        sanitized = sanitized
            .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;') // Fix unescaped &
            .replace(/\r\n/g, '\n') // Normalize line endings
            .trim();
        
        const parser = new DOMParser({
            errorHandler: {
                warning: () => {}, // Suppress warnings
                error: () => {},   // Suppress errors
                fatalError: (e) => { throw e; }
            }
        });
        const doc = parser.parseFromString(sanitized, 'text/xml');
        
        // Try both 'data' (ecowitt) and 'allData' (legacy) tags
        const dataNode = doc.getElementsByTagName('data')[0] || doc.getElementsByTagName('allData')[0];
        if (dataNode && dataNode.textContent) {
            try {
                let jsonStr = dataNode.textContent.trim();
                // Remove CDATA wrapper if present
                jsonStr = jsonStr.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
                return JSON.parse(jsonStr);
            } catch (e) {
                // Try to extract JSON manually if CDATA parsing fails
                const cdataMatch = sanitized.match(/<(data|allData)>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/(data|allData)>/);
                if (cdataMatch && cdataMatch[2]) {
                    try {
                        return JSON.parse(cdataMatch[2]);
                    } catch (e2) {
                        return null;
                    }
                }
                return null;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

function parseEtaXml(xmlContent: string): any {
    try {
        // Sanitize XML
        let sanitized = xmlContent;
        
        if (sanitized.charCodeAt(0) === 0xFEFF) {
            sanitized = sanitized.slice(1);
        }
        
        // Fix common XML attribute errors
        sanitized = sanitized
            .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;')
            .replace(/\r\n/g, '\n')
            // Fix missing quotes in attributes (common error)
            .replace(/(\w+)=([^"\s>]+)(\s|>)/g, '$1="$2"$3')
            .trim();
        
        const parser = new DOMParser({
            errorHandler: {
                warning: () => {},
                error: () => {},
                fatalError: (e) => { throw e; }
            }
        });
        const doc = parser.parseFromString(sanitized, 'text/xml');
        const variables = doc.getElementsByTagName('variable');
        const data: any = {};
        
        for (let i = 0; i < variables.length; i++) {
            const variable = variables[i];
            const pathAttr = variable.getAttribute('path');
            
            // Try to extract structured data
            const valueNode = variable.getElementsByTagName('value')[0];
            const strValueNode = variable.getElementsByTagName('strValue')[0];
            
            if (valueNode && valueNode.textContent) {
                data[pathAttr || i] = { value: valueNode.textContent };
            } else if (strValueNode && strValueNode.textContent) {
                data[pathAttr || i] = { strValue: strValueNode.textContent };
            } else if (variable.textContent) {
                // Fallback: store raw text
                let content = variable.textContent.trim();
                content = content.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
                data[pathAttr || i] = content;
            }
        }
        
        return data;
    } catch (e) {
        // If parsing completely fails, return minimal data
        return { error: 'XML parsing failed', raw: xmlContent.substring(0, 200) };
    }
}

async function migrateEcowitt(db: DatabaseService, stats: MigrationStats): Promise<void> {
    console.log('\n=== Migrating Ecowitt Data ===');
    const dir = path.join(LOG_BASE_DIR, 'ecowitt');
    const files = await getAllFiles(dir, '.xml');
    stats.ecowitt.total = files.length;
    console.log(`Found ${files.length} ecowitt files`);
    
    let batch: any[] = [];
    let skippedFiles: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const timeInfo = parseTimestampFromPath(file);
            if (!timeInfo) {
                skippedFiles.push(file);
                stats.ecowitt.errors++;
                continue;
            }

            const xmlContent = fs.readFileSync(file, 'utf-8');
            const data = parseXmlContent(xmlContent);
            
            if (!data) {
                skippedFiles.push(file);
                stats.ecowitt.errors++;
                continue;
            }

            batch.push({
                timestamp: timeInfo.timestamp.toISOString(),
                year: timeInfo.year,
                month: timeInfo.month,
                day: timeInfo.day,
                hour: timeInfo.hour,
                minute: timeInfo.minute,
                data: JSON.stringify(data)
            });

            if (batch.length >= BATCH_SIZE) {
                const database = db.getDatabase();
                const stmt = database.prepare(`
                    INSERT OR REPLACE INTO ecowitt_logs (timestamp, year, month, day, hour, minute, data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                const insertMany = database.transaction((records: any[]) => {
                    for (const record of records) {
                        stmt.run(record.timestamp, record.year, record.month, record.day, record.hour, record.minute, record.data);
                    }
                });
                insertMany(batch);
                stats.ecowitt.success += batch.length;
                console.log(`Progress: ${stats.ecowitt.success}/${files.length} ecowitt records`);
                batch = [];
            }
        } catch (error) {
            if (stats.ecowitt.errors < 10) {
                console.error(`Error processing ${file}:`, error);
            }
            skippedFiles.push(file);
            stats.ecowitt.errors++;
        }
    }

    // Insert remaining batch
    if (batch.length > 0) {
        const database = db.getDatabase();
        const stmt = database.prepare(`
            INSERT OR REPLACE INTO ecowitt_logs (timestamp, year, month, day, hour, minute, data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMany = database.transaction((records: any[]) => {
            for (const record of records) {
                stmt.run(record.timestamp, record.year, record.month, record.day, record.hour, record.minute, record.data);
            }
        });
        insertMany(batch);
        stats.ecowitt.success += batch.length;
    }

    console.log(`✓ Ecowitt: ${stats.ecowitt.success} migrated, ${stats.ecowitt.errors} errors`);
    
    if (skippedFiles.length > 0 && skippedFiles.length <= 20) {
        console.log(`  Skipped files:`);
        skippedFiles.forEach(f => console.log(`    - ${f}`));
    } else if (skippedFiles.length > 20) {
        console.log(`  Skipped ${skippedFiles.length} files (too many to list)`);
        console.log(`  First 5:`);
        skippedFiles.slice(0, 5).forEach(f => console.log(`    - ${f}`));
    }
}

async function migrateEta(db: DatabaseService, stats: MigrationStats): Promise<void> {
    console.log('\n=== Migrating ETA Data ===');
    const dir = path.join(LOG_BASE_DIR, 'eta');
    const files = await getAllFiles(dir, '.xml');
    stats.eta.total = files.length;
    console.log(`Found ${files.length} eta files`);
    
    let batch: any[] = [];
    let skippedFiles: string[] = [];
    
    for (const file of files) {
        try {
            const timeInfo = parseTimestampFromPath(file);
            if (!timeInfo) {
                skippedFiles.push(file);
                stats.eta.errors++;
                continue;
            }

            const xmlContent = fs.readFileSync(file, 'utf-8');
            const data = parseEtaXml(xmlContent);

            batch.push({
                timestamp: timeInfo.timestamp.toISOString(),
                year: timeInfo.year,
                month: timeInfo.month,
                day: timeInfo.day,
                hour: timeInfo.hour,
                minute: timeInfo.minute,
                data: JSON.stringify(data)
            });

            if (batch.length >= BATCH_SIZE) {
                const database = db.getDatabase();
                const stmt = database.prepare(`
                    INSERT OR REPLACE INTO eta_logs (timestamp, year, month, day, hour, minute, data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                const insertMany = database.transaction((records: any[]) => {
                    for (const record of records) {
                        stmt.run(record.timestamp, record.year, record.month, record.day, record.hour, record.minute, record.data);
                    }
                });
                insertMany(batch);
                stats.eta.success += batch.length;
                console.log(`Progress: ${stats.eta.success}/${files.length} eta records`);
                batch = [];
            }
        } catch (error) {
            if (stats.eta.errors < 10) {
                console.error(`Error processing ${file}:`, error);
            }
            skippedFiles.push(file);
            stats.eta.errors++;
        }
    }

    if (batch.length > 0) {
        const database = db.getDatabase();
        const stmt = database.prepare(`
            INSERT OR REPLACE INTO eta_logs (timestamp, year, month, day, hour, minute, data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMany = database.transaction((records: any[]) => {
            for (const record of records) {
                stmt.run(record.timestamp, record.year, record.month, record.day, record.hour, record.minute, record.data);
            }
        });
        insertMany(batch);
        stats.eta.success += batch.length;
    }

    console.log(`✓ ETA: ${stats.eta.success} migrated, ${stats.eta.errors} errors`);
    
    if (skippedFiles.length > 0 && skippedFiles.length <= 20) {
        console.log(`  Skipped files:`);
        skippedFiles.forEach(f => console.log(`    - ${f}`));
    } else if (skippedFiles.length > 20) {
        console.log(`  Skipped ${skippedFiles.length} files (too many to list)`);
        console.log(`  First 5:`);
        skippedFiles.slice(0, 5).forEach(f => console.log(`    - ${f}`));
    }
}

async function migrateConfig(db: DatabaseService, stats: MigrationStats): Promise<void> {
    console.log('\n=== Migrating Config Data ===');
    const dir = path.join(LOG_BASE_DIR, 'config');
    const files = await getAllFiles(dir, '.json');
    stats.config.total = files.length;
    console.log(`Found ${files.length} config files`);
    
    for (const file of files) {
        try {
            const timeInfo = parseTimestampFromPath(file);
            if (!timeInfo) {
                stats.config.errors++;
                continue;
            }

            const jsonContent = fs.readFileSync(file, 'utf-8');
            const data = JSON.parse(jsonContent);

            const database = db.getDatabase();
            database.prepare(`
                INSERT OR REPLACE INTO config_logs (timestamp, year, month, day, hour, minute, data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                timeInfo.timestamp.toISOString(),
                timeInfo.year,
                timeInfo.month,
                timeInfo.day,
                timeInfo.hour,
                timeInfo.minute,
                JSON.stringify(data)
            );

            stats.config.success++;
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
            stats.config.errors++;
        }
    }

    console.log(`✓ Config: ${stats.config.success} migrated, ${stats.config.errors} errors`);
}

async function migrateTempDiff(db: DatabaseService, stats: MigrationStats): Promise<void> {
    console.log('\n=== Migrating Temp Diff Data ===');
    const dir = path.join(LOG_BASE_DIR, 'temp_diff');
    const files = await getAllFiles(dir, '.xml');
    stats.temp_diff.total = files.length;
    console.log(`Found ${files.length} temp_diff files`);
    
    for (const file of files) {
        try {
            const xmlContent = fs.readFileSync(file, 'utf-8');
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlContent, 'text/xml');
            
            const timestampAttr = doc.documentElement?.getAttribute('timestamp');
            if (!timestampAttr) {
                stats.temp_diff.errors++;
                continue;
            }

            const timestamp = new Date(timestampAttr);
            
            // Parse data from XML
            const diffNode = doc.getElementsByTagName('diff')[0];
            const sliderNode = doc.getElementsByTagName('sliderPosition')[0];
            const tSollNode = doc.getElementsByTagName('t_soll')[0];
            const tDeltaNode = doc.getElementsByTagName('t_delta')[0];
            const indoorTempNode = doc.getElementsByTagName('indoor_temp')[0];

            const diff = diffNode?.textContent ? parseFloat(diffNode.textContent) : 0;
            const sliderPosition = sliderNode?.textContent ? parseInt(sliderNode.textContent) : null;
            const tSoll = tSollNode?.textContent ? parseFloat(tSollNode.textContent) : null;
            const tDelta = tDeltaNode?.textContent ? parseFloat(tDeltaNode.textContent) : null;
            const indoorTemp = indoorTempNode?.textContent ? parseFloat(indoorTempNode.textContent) : null;

            const database = db.getDatabase();
            database.prepare(`
                INSERT INTO temp_diff_logs (timestamp, diff, slider_position, t_soll, t_delta, indoor_temp)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(timestamp.toISOString(), diff, sliderPosition, tSoll, tDelta, indoorTemp);

            stats.temp_diff.success++;
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
            stats.temp_diff.errors++;
        }
    }

    console.log(`✓ Temp Diff: ${stats.temp_diff.success} migrated, ${stats.temp_diff.errors} errors`);
}

async function migrateMinTempStatus(db: DatabaseService, stats: MigrationStats): Promise<void> {
    console.log('\n=== Migrating Min Temp Status Data ===');
    const dir = path.join(LOG_BASE_DIR, 'min_temp_status');
    const files = await getAllFiles(dir, '.xml');
    stats.min_temp_status.total = files.length;
    console.log(`Found ${files.length} min_temp_status files`);
    
    for (const file of files) {
        try {
            const xmlContent = fs.readFileSync(file, 'utf-8');
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlContent, 'text/xml');
            
            const timestampAttr = doc.documentElement?.getAttribute('timestamp');
            if (!timestampAttr) {
                stats.min_temp_status.errors++;
                continue;
            }

            const timestamp = new Date(timestampAttr);
            
            // Parse data from XML
            const diffNode = doc.getElementsByTagName('diff')[0];
            const statusNode = doc.getElementsByTagName('isBelow')[0];

            const diff = diffNode?.textContent ? parseFloat(diffNode.textContent) : 0;
            const status = statusNode?.textContent || 'unknown';

            const database = db.getDatabase();
            database.prepare(`
                INSERT INTO min_temp_status_logs (timestamp, diff, status)
                VALUES (?, ?, ?)
            `).run(timestamp.toISOString(), diff, status);

            stats.min_temp_status.success++;
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
            stats.min_temp_status.errors++;
        }
    }

    console.log(`✓ Min Temp Status: ${stats.min_temp_status.success} migrated, ${stats.min_temp_status.errors} errors`);
}

async function main() {
    console.log('=== SQLite Migration Tool ===\n');
    console.log(`Start time: ${new Date().toISOString()}`);
    console.log(`Log directory: ${LOG_BASE_DIR}\n`);

    const stats: MigrationStats = {
        ecowitt: { total: 0, success: 0, errors: 0 },
        eta: { total: 0, success: 0, errors: 0 },
        config: { total: 0, success: 0, errors: 0 },
        temp_diff: { total: 0, success: 0, errors: 0 },
        min_temp_status: { total: 0, success: 0, errors: 0 }
    };

    try {
        // Initialize database
        const db = DatabaseService.getInstance();
        await db.initialize();
        console.log('✓ Database initialized\n');

        // Migrate each type
        await migrateEcowitt(db, stats);
        await migrateEta(db, stats);
        await migrateConfig(db, stats);
        await migrateTempDiff(db, stats);
        await migrateMinTempStatus(db, stats);

        // Summary
        console.log('\n=== Migration Summary ===');
        console.log(`Ecowitt: ${stats.ecowitt.success}/${stats.ecowitt.total} (${stats.ecowitt.errors} errors)`);
        console.log(`ETA: ${stats.eta.success}/${stats.eta.total} (${stats.eta.errors} errors)`);
        console.log(`Config: ${stats.config.success}/${stats.config.total} (${stats.config.errors} errors)`);
        console.log(`Temp Diff: ${stats.temp_diff.success}/${stats.temp_diff.total} (${stats.temp_diff.errors} errors)`);
        console.log(`Min Temp Status: ${stats.min_temp_status.success}/${stats.min_temp_status.total} (${stats.min_temp_status.errors} errors)`);
        
        const totalSuccess = stats.ecowitt.success + stats.eta.success + stats.config.success + 
                            stats.temp_diff.success + stats.min_temp_status.success;
        const totalFiles = stats.ecowitt.total + stats.eta.total + stats.config.total + 
                          stats.temp_diff.total + stats.min_temp_status.total;
        const totalErrors = stats.ecowitt.errors + stats.eta.errors + stats.config.errors + 
                           stats.temp_diff.errors + stats.min_temp_status.errors;
        
        console.log(`\nTotal: ${totalSuccess}/${totalFiles} migrated (${totalErrors} errors)`);
        console.log(`\nEnd time: ${new Date().toISOString()}`);
        console.log('\n✓ Migration completed successfully!');

        // Save metadata
        const database = db.getDatabase();
        database.prepare(`
            INSERT OR REPLACE INTO migration_metadata (key, value)
            VALUES ('last_migration', ?)
        `).run(new Date().toISOString());

        await db.close();
    } catch (error) {
        console.error('\n✗ Migration failed:', error);
        process.exit(1);
    }
}

main();
