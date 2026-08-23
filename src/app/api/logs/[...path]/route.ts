import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DatabaseHelpers } from '@/lib/database/dbHelpers';
import { isLogType } from '@/lib/logTypes';
import { formatLogData } from '@/utils/logging';

async function getDatabaseLog(pathSegments: string[]): Promise<NextResponse | null> {
  if (pathSegments.length !== 5 || !isLogType(pathSegments[0])) return null;
  const year = Number(pathSegments[1]);
  const idMatch = pathSegments[4].match(/-id(\d+)\.(?:xml|json|jsonl)$/);
  if (!Number.isInteger(year) || !idMatch) return null;

  const type = pathSegments[0];
  const entry = await new DatabaseHelpers().getLogEntry(type, year, Number(idMatch[1]));
  if (!entry || typeof entry.timestamp !== 'string') return null;

  let data: Record<string, unknown>;
  if (type === 'ecowitt' || type === 'eta' || type === 'config') {
    if (typeof entry.data !== 'string') return null;
    data = JSON.parse(entry.data) as Record<string, unknown>;
  } else if (type === 'temp_diff') {
    data = {
      diff: entry.diff,
      sliderPosition: entry.slider_position,
      t_soll: entry.t_soll,
      t_delta: entry.t_delta,
      indoor_temp: entry.indoor_temp,
    };
  } else {
    data = { diff: entry.diff, status: entry.status };
  }

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  headers.set(
    'Content-Type',
    type === 'config'
      ? 'application/json; charset=utf-8'
      : type === 'temp_diff' || type === 'min_temp_status'
        ? 'application/x-ndjson; charset=utf-8'
        : 'application/xml; charset=utf-8',
  );
  return new NextResponse(formatLogData(type, data, new Date(entry.timestamp)), { status: 200, headers });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path: pathSegments } = await params;

  try {
    if (!Array.isArray(pathSegments) ||
      pathSegments.some(segment => !segment || segment === '..' || segment.includes('/') || segment.includes('\\'))) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    // Helper to get runtime root
    const getRuntimeRoot = () => process.cwd();

    // Reconstruct the file path using spread operator
    // Use 'public/log' as a single segment to avoid broad globbing
    const filePath = path.join(getRuntimeRoot(), 'public/log', ...pathSegments);

    // Verify the path is within the logs directory
    const normalizedPath = path.normalize(filePath);
    const logsDir = path.resolve(getRuntimeRoot(), 'public/log');
    if (normalizedPath !== logsDir && !normalizedPath.startsWith(`${logsDir}${path.sep}`)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    // Prefer legacy/fallback files when present; new SQLite-backed paths carry
    // an explicit row id and are rendered directly from the database.
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      const databaseLog = await getDatabaseLog(pathSegments);
      if (databaseLog) return databaseLog;
      throw error;
    }

    // Set appropriate headers based on file extension
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    if (filePath.endsWith('.xml')) {
      headers.set('Content-Type', 'application/xml; charset=utf-8');
      // Sanitize XML: remove UTF-8 BOM and any leading non-XML characters
      let text = fileBuffer.toString('utf-8');
      if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
      const firstLt = text.indexOf('<');
      if (firstLt > 0) {
        text = text.slice(firstLt);
      }
      // Ensure only the first XML declaration is kept
      if (text.startsWith('<?xml')) {
        const declEnd = text.indexOf('?>');
        if (declEnd !== -1) {
          const head = text.slice(0, declEnd + 2);
          let body = text.slice(declEnd + 2);
          body = body.replace(/<\?xml[^>]*>\s*/gi, '');
          text = head + body;
        }
      } else {
        // If no declaration at top, strip any stray declarations
        text = text.replace(/<\?xml[^>]*>\s*/gi, '');
      }

      // Backward-compatibility: some older 'eta' logs contain JSON-stringified XML inside <variable> text.
      // For paths under /eta/... try to decode inner JSON string and wrap as CDATA if it looks like XML.
      const firstSegment = Array.isArray(pathSegments) && pathSegments.length > 0 ? pathSegments[0] : '';
      if (firstSegment === 'eta') {
        const looksLikeXml = (s: string) => /<\w+[\s>]/.test(s) || /^\s*<\?xml/i.test(s);
        text = text.replace(/(<variable[^>]*>)(\"[\s\S]*?)(<\/variable>)/g, (match, open, inner, close) => {
          try {
            // inner starts with an escaped quote, convert escaped sequences back
            // Replace XML-escaped backslash-escaped quotes and newlines by turning the whole thing back via JSON.parse
            // Build a proper JSON string by surrounding inner (which includes starting \") with quotes removed
            const jsonLike = inner;
            // Undo XML entity escaping if present
            const unescaped = jsonLike
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&');
            // Now turn the escaped content into a real string using JSON.parse
            const decoded = JSON.parse(unescaped);
            if (typeof decoded === 'string' && looksLikeXml(decoded)) {
              return `${open}<![CDATA[${decoded}]]>${close}`;
            }
          } catch {
            // keep original on failure
          }
          return match;
        });
      }
      return new NextResponse(text, {
        status: 200,
        headers,
      });
    } else if (filePath.endsWith('.json')) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      const jsonText = fileBuffer.toString('utf-8');
      return new NextResponse(jsonText, {
        status: 200,
        headers,
      });
    } else if (filePath.endsWith('.jsonl')) {
      headers.set('Content-Type', 'application/x-ndjson; charset=utf-8');
      return new NextResponse(fileBuffer.toString('utf-8'), { status: 200, headers });
    }

    // Default: serve as text for unknown extensions
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    const text = fileBuffer.toString('utf-8');
    return new NextResponse(text, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error serving log file:', error);
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }
}
