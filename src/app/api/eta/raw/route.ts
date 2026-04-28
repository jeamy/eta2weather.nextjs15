import { NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig } from '@/utils/cache';
import { MenuNode } from '@/types/menu';
import { getAllUris } from '@/utils/etaUtils';
import { parseEtaMenuXml } from '@/reader/functions/etaMenuParser';

async function getMenuItems(etaApi: EtaApi): Promise<MenuNode[]> {
  const response = await etaApi.getMenu();
  if (response.error || !response.result) {
    throw new Error(response.error || 'Failed to fetch menu items');
  }
  return parseEtaMenuXml(response.result);
}

export async function GET() {
  let etaApi: EtaApi | null = null;
  try {
    const config = await getConfig();
    etaApi = new EtaApi(config.s_eta);
    const menuItems = await getMenuItems(etaApi);
    
    // Collect all URIs from menu items
    const rawData: Record<string, any> = {};
    
    for (const uri of getAllUris(menuItems)) {
      const response = await etaApi.getUserVar(uri);
      if (response.result) {
        rawData[uri] = response.result;
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
