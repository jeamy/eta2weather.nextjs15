import { NextRequest, NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { parseXML } from '@/reader/functions/EtaData';
import { getConfig } from '@/utils/cache';
import { isValidEndpointUri } from '@/utils/etaUtils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const uri = searchParams.get('uri');

  if (!uri) {
    return NextResponse.json(
      { success: false, error: 'URI parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Check if the URI is a valid endpoint URI
    if (!isValidEndpointUri(uri)) {
      console.log(`Skipping category URI in readMenuData: ${uri}`);
      return NextResponse.json(
        { success: false, error: `Invalid URI format: ${uri} is a category URI, not an endpoint URI` },
        { status: 400 }
      );
    }
    
    const config = await getConfig();

    // Create EtaApi instance
    const etaApi = new EtaApi(config.s_eta);

    // Get menu data
    const menuResponse = await etaApi.getUserVar(uri);
    
    if (menuResponse.error || !menuResponse.result) {
        return NextResponse.json(
            { success: false, error: menuResponse.error || 'No menu data received' },
            { status: 500 }
        );
    }

    // Parse XML data
    const parsedData = parseXML(menuResponse.result, uri, null);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('Error in eta/readMenuData:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read menu data' },
      { status: 500 }
    );
  }
}
