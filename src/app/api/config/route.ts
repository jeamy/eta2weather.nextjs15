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

// Ensure config file exists with valid JSON
const ensureConfigFile = () => {
  if (!fs.existsSync(configPath)) {
    const defaultConfig: Config = {};
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (error) {
    // If JSON is invalid, create new file with empty config
    const defaultConfig: Config = {};
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  }
};

export async function GET() {
  try {
    const config = ensureConfigFile();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    return NextResponse.json(
      { error: 'Failed to read config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json();

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    // Ensure we have a valid config
    let config = ensureConfigFile();

    // Update config with the new value
    // Convert value to string if it isn't already
    config[key] = value.toString();

    // Write the updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
