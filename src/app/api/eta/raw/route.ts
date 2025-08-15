import { NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig } from '@/utils/cache';
import { MenuNode } from '@/types/menu';
import { isValidEndpointUri } from '@/utils/etaUtils';

async function getMenuItems(): Promise<MenuNode[]> {
  const response = await fetch('http://localhost:3000/api/eta/menu');
  const result = await response.json();
  if (result.success && Array.isArray(result.data)) {
    return result.data;
  }
  throw new Error('Failed to fetch menu items');
}

export async function GET() {
  try {
    const config = await getConfig();
    const etaApi = new EtaApi(config.s_eta);
    const menuItems = await getMenuItems();
    
    // Collect all URIs from menu items
    const rawData: Record<string, any> = {};
    
    for (const category of menuItems) {
      if (category.children) {
        for (const item of category.children) {
          if (item.uri) {
            // Only fetch data for valid endpoint URIs
            if (isValidEndpointUri(item.uri)) {
              const response = await etaApi.getUserVar(item.uri);
              if (response.result) {
                rawData[item.uri] = response.result;
              }
            } else {
              console.log(`Skipping category URI: ${item.uri}`);
            }
          }
          
          if (item.children) {
            for (const subItem of item.children) {
              if (subItem.uri) {
                // Only fetch data for valid endpoint URIs
                if (isValidEndpointUri(subItem.uri)) {
                  const response = await etaApi.getUserVar(subItem.uri);
                  if (response.result) {
                    rawData[subItem.uri] = response.result;
                  }
                } else {
                  console.log(`Skipping category URI: ${subItem.uri}`);
                }
              }
            }
          }
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
  }
}
