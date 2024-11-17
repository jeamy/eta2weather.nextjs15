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
    let config: Config;
    
    try {
      config = JSON.parse(data.trim());
    } catch (parseError) {
      console.error('Error parsing config file:', parseError);
      return res.status(500).json({ error: 'Invalid config file format' });
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

    // Write updated config back to file
    await fs.writeFile(configFilePath, JSON.stringify(config, null, 2), 'utf-8');

    res.status(200).json(config);
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
