import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    if (!fs.existsSync(configPath)) {
      return NextResponse.json({});
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config: Config = JSON.parse(content);
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
    
    // Read existing config
    let config: Config = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      try {
        config = JSON.parse(content);
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid config file format' },
          { status: 400 }
        );
      }
    }

    // Update channel names in config
    config.channelNames = {
      ...(config.channelNames || {}),
      ...newChannelNames
    };

    // Write the updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing channel names:', error);
    return NextResponse.json(
      { error: 'Failed to write channel names' },
      { status: 500 }
    );
  }
}
