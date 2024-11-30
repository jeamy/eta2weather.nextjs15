import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config.channelNames || {});
  } catch (error) {
    console.error('Error reading channel names:', error);
    return NextResponse.json(
      { error: 'Failed to read channel names' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const newChannelNames = await request.json();
    
    // Get existing config using cache utility
    const config = await getConfig();
    
    // Update channel names in config
    const updatedConfig = {
      ...config,
      channelNames: {
        ...(config.channelNames || {}),
        ...newChannelNames
      }
    };

    // Update config using cache utility
    await updateConfig(updatedConfig);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing channel names:', error);
    return NextResponse.json(
      { error: 'Failed to write channel names' },
      { status: 500 }
    );
  }
}
