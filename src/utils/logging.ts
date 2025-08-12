import fs from 'fs';
import path from 'path';

type LogType = 'ecowitt' | 'eta' | 'config' | 'temp_diff' | 'min_temp_status';

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

    const escapeXmlText = (s: string): string =>
        s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

    const escapeAttr = (s: string): string =>
        s
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const looksLikeXml = (s: string): boolean => /^\s*<\?xml/i.test(s) || /<\w+[\s>]/.test(s);

    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
        v !== null && typeof v === 'object' && !Array.isArray(v);

    // Format data based on type
    let formattedData = '';
    if (type === 'config') {
        formattedData = JSON.stringify(data, null, 2);
    } else if (type === 'eta') {
        // Structured handling for ETA data
        const lines: string[] = [];
        lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
        lines.push(`<${type}Data timestamp="${now.toISOString()}">`);
        for (const [key, value] of Object.entries(data)) {
            const pathAttr = escapeAttr(key);
            if (isPlainObject(value)) {
                const v = value as Record<string, unknown>;
                const known: Array<keyof typeof v> = [
                    'id', 'uri', 'value', 'strValue', 'unit', 'short', 'long', 'scaleFactor', 'decPlaces', 'advTextOffset'
                ];
                lines.push(`  <variable path="${pathAttr}">`);
                for (const k of known) {
                    if (v[k] !== undefined && v[k] !== null) {
                        const content = escapeXmlText(String(v[k] as unknown));
                        lines.push(`    <${String(k)}>${content}</${String(k)}>`);
                    }
                }
                const extras = Object.keys(v).filter(k => !known.includes(k as any));
                if (extras.length) {
                    lines.push(`    <extra>`);
                    for (const ek of extras) {
                        const content = v[ek];
                        const text = content === undefined || content === null ? '' : String(content);
                        lines.push(`      <field name="${escapeAttr(ek)}">${escapeXmlText(text)}</field>`);
                    }
                    lines.push(`    </extra>`);
                }
                lines.push(`  </variable>`);
            } else {
                const text = value === undefined || value === null ? '' : String(value);
                if (looksLikeXml(text)) {
                    lines.push(`  <variable path="${pathAttr}"><![CDATA[${text}]]></variable>`);
                } else {
                    lines.push(`  <variable path="${pathAttr}">${escapeXmlText(text)}</variable>`);
                }
            }
        }
        lines.push(`</${type}Data>`);
        formattedData = lines.join('\n');
    } else {
        // Handle other XML types (like ecowitt)
        formattedData = `<?xml version="1.0" encoding="UTF-8"?>\n<${type}Data timestamp="${now.toISOString()}">\n${Object.entries(data).map(([key, value]) => {
            const tag = key; // assume simple keys
            const text = value === undefined || value === null ? '' : JSON.stringify(value);
            return `  <${tag}><![CDATA[${text}]]></${tag}>`;
        }).join('\n')}\n</${type}Data>`;
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
