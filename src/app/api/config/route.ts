import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logData } from '@/utils/logging';
import { getConfig, updateConfig } from '@/utils/cache';

interface Config {
  t_soll?: string;
  t_delta?: string;
  t_slider?: string;
  s_eta?: string;
  f_eta?: string;
  f_wifiaf83?: string;
  f_names2id?: string;
  t_update_timer?: string;
  diff?: string;
  channelNames?: {
    [key: string]: string;
  };
  [key: string]: any;
}

const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

export async function GET() {
  try {
    const config = await getConfig();
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
    const { key, value } = await request.json();
    
    // Get existing config
    const existingConfig = await getConfig();
    
    // Update the specific key in the config
    const updatedConfig = {
      ...existingConfig,
      [key]: value
    };
    
    // Update the config using cache utility
    await updateConfig(updatedConfig);
    
    // Log the config change
    await logData('config', { key, value });
    
    return NextResponse.json({ 
      success: true, 
      config: updatedConfig 
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
