import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '@/reader/functions/types-constants/ConfigConstants';
import { EtaApi } from '@/reader/functions/EtaApi';

export async function POST(request: NextRequest) {
  try {
    // Read config file
    const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: Config = JSON.parse(configData);

    const body = await request.json();
    const { id, value, begin = "0", end = "0" } = body;

    console.log(`Setting user var for ID: ${id} with value: ${value}, begin: ${begin}, end: ${end}`);

    if (!id || !value) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const etaApi = new EtaApi(config.s_eta);
    const result = await etaApi.setUserVar(id, value, begin, end);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in eta/update:', error);
    return NextResponse.json(
      { error: 'Failed to update ETA data' },
      { status: 500 }
    );
  }
}
