import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { EtaApi } from '@/reader/functions/EtaApi';
import { parseXML } from '@/reader/functions/EtaData';

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
    // Read config file
    const configFile = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
    const configData = await fs.readFile(configFile, 'utf8');
    const config = JSON.parse(configData);

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
