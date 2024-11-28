import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Config, defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';

export async function GET() {
//  console.log('Config read API called');
  const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
//  console.log('Config file path:', configFilePath);

  try {
    let configData: Config;

    try {
      const fileExists = await fs.access(configFilePath).then(() => true).catch(() => false);
      // console.log('Config file exists:', fileExists);

      if (fileExists) {
        const data = await fs.readFile(configFilePath, 'utf-8');
        // console.log('Raw config data:', data);
        configData = JSON.parse(data);
      } else {
        // console.log('Using default config');
        configData = defaultConfig;
        // Create the config file with default values
        await fs.writeFile(configFilePath, JSON.stringify(defaultConfig, null, 2));
      }
    } catch (readError) {
      console.error('Error reading config file:', readError);
      configData = defaultConfig;
    }

    // console.log('Sending config data:', configData);
    return NextResponse.json({ success: true, data: configData });
  } catch (error) {
    console.error('Error in config/read:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
