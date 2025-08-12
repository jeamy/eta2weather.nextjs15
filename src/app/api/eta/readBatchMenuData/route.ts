import { NextRequest } from 'next/server';
import { readMenuData } from '@/reader/functions/readMenuData';

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body safely to avoid throwing on empty/aborted requests
    let body: any = null;
    try {
      body = await request.json();
    } catch (_err) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400 }
      );
    }

    const uris = body?.uris;
    if (!Array.isArray(uris)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: uris must be an array' }),
        { status: 400 }
      );
    }

    if (uris.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: {}, message: 'No URIs provided' }),
        { status: 200 }
      );
    }

    const results: Record<string, any> = {};
    let hasSuccessfulResults = false;
    
    // Process all URIs in parallel with a concurrency limit
    const batchSize = 5; // Process 5 URIs at a time
    for (let i = 0; i < uris.length; i += batchSize) {
      const batch = uris.slice(i, i + batchSize);
      const promises = batch.map(async (uri) => {
        try {
          const data = await readMenuData(uri);
          if (data !== null) {
            results[uri] = data;
            hasSuccessfulResults = true;
          }
        } catch (error) {
          console.error(`Error reading data for URI ${uri}:`, error);
        }
      });

      await Promise.all(promises);
      
      // Add a small delay between batches to prevent overwhelming the server
      if (i + batchSize < uris.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // If we have at least some successful results, consider it a success
    return new Response(
      JSON.stringify({ 
        success: hasSuccessfulResults, 
        data: results,
        message: hasSuccessfulResults ? undefined : 'No data could be retrieved'
      }),
      { status: hasSuccessfulResults ? 200 : 500 }
    );
  } catch (error) {
    console.error('Error in batch menu data read:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred' 
      }),
      { status: 500 }
    );
  }
}
