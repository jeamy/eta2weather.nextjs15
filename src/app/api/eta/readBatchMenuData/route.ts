import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { parseXML } from '@/reader/functions/EtaData';
import { getConfig } from '@/utils/cache';
import { isValidEndpointUri } from '@/utils/etaUtils';

const MAX_BATCH_URIS = 500;

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body safely to avoid throwing on empty/aborted requests
    let body: any = null;
    try {
      body = await request.json();
    } catch (_err) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const uris = body?.uris;
    if (!Array.isArray(uris)) {
      return NextResponse.json({ success: false, error: 'Invalid request: uris must be an array' }, { status: 400 });
    }

    if (uris.length > MAX_BATCH_URIS) {
      return NextResponse.json(
        { success: false, error: `Too many URIs; maximum is ${MAX_BATCH_URIS}` },
        { status: 413 },
      );
    }

    if (uris.length === 0) {
      return NextResponse.json({ success: true, data: {}, message: 'No URIs provided' });
    }

    const validUris = Array.from(new Set(uris.filter((uri): uri is string => typeof uri === 'string' && isValidEndpointUri(uri))));
    const filteredCount = uris.length - validUris.length;
    
    if (filteredCount > 0) {
      console.log(`Filtered out ${filteredCount} category URIs from batch request`);
    }

    const results: Record<string, any> = {};
    let hasSuccessfulResults = false;

    const etaApi = new EtaApi((await getConfig()).s_eta);
    try {
      const batchSize = 5;
      for (let i = 0; i < validUris.length; i += batchSize) {
        const batch = validUris.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async uri => {
          try {
            const response = await etaApi.getUserVar(uri, request.signal);
            if (response.error || !response.result) {
              console.error(`Error reading data for URI ${uri}:`, response.error || 'empty response');
              return null;
            }
            return [uri, parseXML(response.result, uri, null)] as const;
          } catch (error) {
            console.error(`Error parsing data for URI ${uri}:`, error);
            return null;
          }
        }));
        for (const result of batchResults) {
          if (!result) continue;
          results[result[0]] = result[1];
          hasSuccessfulResults = true;
        }
        if (i + batchSize < validUris.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      etaApi.dispose();
    }

    // If we have at least some successful results, consider it a success
    return NextResponse.json(
      {
        success: hasSuccessfulResults, 
        data: results,
        message: hasSuccessfulResults ? undefined : 'No data could be retrieved'
      },
      { status: hasSuccessfulResults ? 200 : 502 }
    );
  } catch (error) {
    console.error('Error in batch menu data read:', error);
    return NextResponse.json(
      {
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred' 
      },
      { status: 500 }
    );
  }
}
