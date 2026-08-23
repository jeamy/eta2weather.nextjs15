import fs from 'fs';
import path from 'path';
import { DatabaseService } from '@/lib/database/sqliteService';
import { getLogExtension, LogType } from '@/lib/logTypes';

const escapeXmlText = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const escapeAttr = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const looksLikeXml = (s: string): boolean => /^\s*<\?xml/i.test(s) || /<\w+[\s>]/.test(s);
const escapeCdata = (s: string): string => s.replace(/\]\]>/g, ']]]]><![CDATA[>');
const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

export function formatLogData(type: LogType, data: any, timestamp: Date = new Date()): string {
    if (type === 'temp_diff' || type === 'min_temp_status') {
        return JSON.stringify({ timestamp: timestamp.toISOString(), ...data });
    }
    if (type === 'config') {
        return JSON.stringify(data, null, 2);
    }
    if (type === 'eta') {
        const lines: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`, `<${type}Data timestamp="${timestamp.toISOString()}">`];
        for (const [key, value] of Object.entries(data)) {
            const pathAttr = escapeAttr(key);
            if (isPlainObject(value)) {
                const known = ['id', 'uri', 'value', 'strValue', 'unit', 'short', 'long', 'scaleFactor', 'decPlaces', 'advTextOffset'];
                lines.push(`  <variable path="${pathAttr}">`);
                for (const keyName of known) {
                    if (value[keyName] !== undefined && value[keyName] !== null) {
                        lines.push(`    <${keyName}>${escapeXmlText(String(value[keyName]))}</${keyName}>`);
                    }
                }
                const extras = Object.keys(value).filter(keyName => !known.includes(keyName));
                if (extras.length) {
                    lines.push('    <extra>');
                    for (const extra of extras) {
                        lines.push(`      <field name="${escapeAttr(extra)}">${escapeXmlText(String(value[extra] ?? ''))}</field>`);
                    }
                    lines.push('    </extra>');
                }
                lines.push('  </variable>');
            } else {
                const text = String(value ?? '');
                lines.push(looksLikeXml(text)
                    ? `  <variable path="${pathAttr}"><![CDATA[${escapeCdata(text)}]]></variable>`
                    : `  <variable path="${pathAttr}">${escapeXmlText(text)}</variable>`);
            }
        }
        lines.push(`</${type}Data>`);
        return lines.join('\n');
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<${type}Data timestamp="${timestamp.toISOString()}">\n${Object.entries(data).map(([key, value]) => {
        const text = value === undefined || value === null ? '' : JSON.stringify(value);
        return `  <${key}><![CDATA[${escapeCdata(text)}]]></${key}>`;
    }).join('\n')}\n</${type}Data>`;
}

export const logData = async (type: LogType, data: any) => {
    let sqliteSuccess = false;

    // Write to SQLite database
    try {
        const db = DatabaseService.getInstance();

        switch (type) {
            case 'ecowitt':
                await db.insertEcowittLog(data);
                break;
            case 'eta':
                await db.insertEtaLog(data);
                break;
            case 'config':
                await db.insertConfigLog(data);
                break;
            case 'temp_diff':
                await db.insertTempDiffLog(data);
                break;
            case 'min_temp_status':
                await db.insertMinTempStatusLog(data);
                break;
        }
        sqliteSuccess = true;
    } catch (error) {
        console.error(`Error writing to SQLite (${type}):`, error);
        // Continue to file-based logging as fallback
    }

    if (sqliteSuccess) {
        return `sqlite:${type}`;
    }

    // Keep file-based logging as backup/fallback
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');

    // Helper to get runtime root and prevent static analysis from seeing overly broad patterns
    const getRuntimeRoot = () => process.cwd();

    const baseDir = path.join(getRuntimeRoot(), 'public/log', type, String(year), month, day);
    const fileName = `${hour}-${minute}.${getLogExtension(type)}`;
    const filePath = path.join(baseDir, fileName);

    // Create directory structure if it doesn't exist
    await fs.promises.mkdir(baseDir, { recursive: true });

    const formattedData = formatLogData(type, data, now);

    // Write the file
    if (type === 'temp_diff' || type === 'min_temp_status') {
        await fs.promises.appendFile(filePath, `${formattedData}\n`);
    } else {
        await fs.promises.writeFile(filePath, formattedData);
    }
    return filePath;
};

export const getLogFiles = async (type: LogType, limit = 1000) => {
    // Try to get from SQLite first
    try {
        const { DatabaseHelpers } = await import('@/lib/database/dbHelpers');
        const helpers = new DatabaseHelpers();
        const dbFiles = await helpers.getLogsAsFilePaths(type, limit);
        if (dbFiles && dbFiles.length > 0) {
            return dbFiles;
        }
    } catch (error) {
        console.error(`Error getting logs from SQLite for ${type}:`, error);
    }

    // Fallback to file-system
    // Helper to get runtime root
    const getRuntimeRoot = () => process.cwd();
    const baseDir = path.join(getRuntimeRoot(), 'public/log', type);
    const files: string[] = [];

    try {
        // Check if base directory exists
        if (!fs.existsSync(baseDir)) {
            return files;
        }

        // Recursively get all files
        const processDir = async (dir: string) => {
            const items = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    await processDir(fullPath);
                } else {
                    // Get path relative to the base log directory
                    const relativePath = path.relative(path.join(getRuntimeRoot(), 'public/log'), fullPath);
                    files.push(relativePath);
                }
            }
        };

        await processDir(baseDir);
        return files.sort().reverse().slice(0, limit);
    } catch (error) {
        console.error(`Error getting log files for ${type}:`, error);
        return files;
    }
};
