import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Config, ConfigKeys } from '@/reader/functions/types-constants/ConfigConstants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

  try {
    // Read current config
    const data = await fs.readFile(configFilePath, 'utf-8');
    console.log('Raw config file content:', data);
    
    let config: Config;
    
    try {
      // Remove any trailing commas and normalize the JSON
      const cleanData = data.trim()
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/}\s*}/g, '}') // Remove multiple closing braces
        .replace(/\n\s*\n/g, '\n'); // Remove empty lines
      
      console.log('Cleaned config file content:', cleanData);
      
      try {
        config = JSON.parse(cleanData);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        return res.status(500).json({ 
          error: 'JSON Parse Error', 
          message: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error',
          rawData: data,
          cleanedData: cleanData
        });
      }
    } catch (cleanError) {
      console.error('Error cleaning config data:', cleanError);
      return res.status(500).json({ 
        error: 'Data Cleaning Error',
        message: cleanError instanceof Error ? cleanError.message : 'Unknown cleaning error',
        rawData: data
      });
    }

    // Update the specified key
    const { key, value } = req.body;
    
    // Validate key and value
    if (!Object.values(ConfigKeys).includes(key)) {
      return res.status(400).json({ error: 'Invalid config key' });
    }

    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'Value must be a string' });
    }

    // Create new config object with the updated value
    config = {
      ...config,
      [key]: value
    };

    // Write updated config back to file with proper formatting
    const updatedJson = JSON.stringify(config, null, 2) + '\n';
    await fs.writeFile(configFilePath, updatedJson, 'utf-8');

    res.status(200).json(config);
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error
    });
  }
}
