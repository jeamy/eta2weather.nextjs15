import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path: pathSegments } = await params;

  try {
    // Reconstruct the file path using spread operator
    // Reconstruct the file path using spread operator
    // Use 'public/log' as a single segment to avoid broad globbing
    const filePath = path.join(process.cwd(), 'public/log', ...pathSegments);

    // Verify the path is within the logs directory
    const normalizedPath = path.normalize(filePath);
    const logsDir = path.join(process.cwd(), 'public/log');
    if (!normalizedPath.startsWith(logsDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    // Read the file as Buffer to allow BOM removal/sanitization for XML
    const fileBuffer = await fs.readFile(filePath);

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
