import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Config, ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';

export async function POST(request: NextRequest) {
  try {
    const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
    
    // Read current config
    const data = await fs.readFile(configFilePath, 'utf-8');
    let config: Config = JSON.parse(data);
    
    // Get update data from request body
    const { key, value } = await request.json();
    
    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Update config with new value
    if (key in config) {
      const typedKey = key as ConfigKeys;
      config[typedKey] = value;
    }

    // Write updated config back to file
    await fs.writeFile(configFilePath, JSON.stringify(config, null, 2));

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error in config/update:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
