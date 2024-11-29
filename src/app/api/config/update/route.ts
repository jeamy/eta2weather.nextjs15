import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Config, ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';

export async function POST(request: NextRequest) {
  const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

  try {
    // Read current config
    const data = await fs.readFile(configFilePath, 'utf-8');
    let config: Config;
    
    try {
      // Remove any trailing commas and normalize the JSON
      const cleanData = data.trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/\s*}\s*}/g, '}}') // Fix multiple closing braces spacing
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/[^\x20-\x7E\n\r\t]/g, ''); // Remove non-printable characters
      
      try {
        config = JSON.parse(cleanData);
        
        // Validate required fields
        const requiredFields: ConfigKeys[] = [
          ConfigKeys.T_SOLL,
          ConfigKeys.T_DELTA,
          ConfigKeys.T_SLIDER,
          ConfigKeys.S_ETA,
          ConfigKeys.CHANNEL_NAMES
        ];
        for (const field of requiredFields) {
          if (!(field in config)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      } catch (error) {
        const jsonError = error as Error;
        console.error('Error parsing cleaned JSON:', jsonError);
        console.error('Cleaned data:', cleanData);
        throw new Error(`Invalid JSON format: ${jsonError.message}`);
      }
    } catch (parseError) {
      console.error('Error parsing config file:', parseError);
      return NextResponse.json(
        { error: 'Invalid config file format' },
        { status: 500 }
      );
    }

    // Get update data from request body
    const updateData = await request.json();

    // Validate update data
    if (!updateData || typeof updateData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid update data' },
        { status: 400 }
      );
    }

    // Update config with new values
    Object.keys(updateData).forEach((key) => {
      if (key in config) {
        const typedKey = key as ConfigKeys;
        config[typedKey] = updateData[key];
      }
    });

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
