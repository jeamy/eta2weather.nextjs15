import { NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig } from '@/utils/cache';
import { MenuNode } from '@/types/menu';
import { getAllUris } from '@/utils/etaUtils';
import { parseEtaMenuXml } from '@/reader/functions/etaMenuParser';

async function getMenuItems(etaApi: EtaApi, signal?: AbortSignal): Promise<MenuNode[]> {
  const response = await etaApi.getMenu(signal);
  if (response.error || !response.result) {
    throw new Error(response.error || 'Failed to fetch menu items');
  }
  return parseEtaMenuXml(response.result);
}

export async function GET(request: Request) {
  let etaApi: EtaApi | null = null;
  try {
    const config = await getConfig();
    etaApi = new EtaApi(config.s_eta);
    const menuItems = await getMenuItems(etaApi, request.signal);
    
    // Collect all URIs from menu items
    const rawData: Record<string, any> = {};
    
    const uris = getAllUris(menuItems).slice(0, 1000);
    const batchSize = 5;
    for (let i = 0; i < uris.length; i += batchSize) {
      const batch = uris.slice(i, i + batchSize);
      const responses = await Promise.all(batch.map(async uri => ({ uri, response: await etaApi!.getUserVar(uri, request.signal) })));
      for (const { uri, response } of responses) {
        if (response.result) {
          rawData[uri] = response.result;
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        menuItems,
        rawData
      }
    });
  } catch (error) {
    console.error('Error fetching raw ETA data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ETA data' },
      { status: 500 }
    );
  } finally {
    etaApi?.dispose();
  }
}
