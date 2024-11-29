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
    const filePath = path.join(process.cwd(), 'public', 'log', ...pathSegments);

    // Verify the path is within the logs directory
    const normalizedPath = path.normalize(filePath);
    const logsDir = path.join(process.cwd(), 'public', 'log');
    if (!normalizedPath.startsWith(logsDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    // Read the file
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Set appropriate headers based on file extension
    const headers = new Headers();
    if (filePath.endsWith('.xml')) {
      headers.set('Content-Type', 'application/xml');
    } else if (filePath.endsWith('.json')) {
      headers.set('Content-Type', 'application/json');
    }

    return new NextResponse(fileContent, {
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
