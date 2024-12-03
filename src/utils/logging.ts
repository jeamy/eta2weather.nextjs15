import fs from 'fs';
import path from 'path';

type LogType = 'ecowitt' | 'eta' | 'config' | 'temp_diff';

export const logData = async (type: LogType, data: any) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');

    const baseDir = path.join(process.cwd(), 'public', 'log', type, String(year), month, day);
    const fileName = `${hour}-${minute}.${type === 'config' ? 'json' : 'xml'}`;
    const filePath = path.join(baseDir, fileName);

    // Create directory structure if it doesn't exist
    await fs.promises.mkdir(baseDir, { recursive: true });

    // Format data based on type
    let formattedData = '';
    if (type === 'config') {
        formattedData = JSON.stringify(data, null, 2);
    } else if (type === 'eta') {
        // Special handling for ETA data
        formattedData = `<?xml version="1.0" encoding="UTF-8"?>
<${type}Data timestamp="${now.toISOString()}">
${Object.entries(data).map(([key, value]) => {
    // Convert path-like keys to valid XML element names
    const safeKey = key.replace(/[\/\.]/g, '_').replace(/^_+|_+$/g, '');
    return `  <variable path="${key}">${JSON.stringify(value)}</variable>`;
}).join('\n')}
</${type}Data>`;
    } else {
        // Handle other XML types (like ecowitt)
        formattedData = `<?xml version="1.0" encoding="UTF-8"?>
<${type}Data timestamp="${now.toISOString()}">
${Object.entries(data).map(([key, value]) => `  <${key}>${JSON.stringify(value)}</${key}>`).join('\n')}
</${type}Data>`;
    }

    // Write the file
    await fs.promises.writeFile(filePath, formattedData);
    return filePath;
};

export const getLogFiles = async (type: LogType) => {
    const baseDir = path.join(process.cwd(), 'public', 'log', type);
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
                    const relativePath = path.relative(path.join(process.cwd(), 'public', 'log'), fullPath);
                    files.push(relativePath);
                }
            }
        };

        await processDir(baseDir);
        return files;
    } catch (error) {
        console.error(`Error getting log files for ${type}:`, error);
        return files;
    }
};
