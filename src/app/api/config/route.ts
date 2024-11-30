import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logData } from '@/utils/logging';

interface Config {
  t_soll?: string;
  t_delta?: string;
  t_slider?: string;
  s_eta?: {
    [key: string]: string;
  };
  [key: string]: any;
}

const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

export async function GET() {
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error reading config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const newConfig = await request.json();
    
    // Write the new config to file
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));

    // Log the config change
    await logData('config', newConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
