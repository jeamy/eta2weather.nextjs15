import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Config, defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

  try {
    let configData: Config;

    try {
      const data = await fs.readFile(configFilePath, 'utf-8');
      configData = JSON.parse(data);
    } catch (readError) {
      // If file doesn't exist or can't be parsed, use default values
      console.error('Error reading config file:', readError);
      configData = defaultConfig;
      
      // If file doesn't exist, create it with default values
      if ((readError as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(configFilePath, JSON.stringify(defaultConfig, null, 2));
      }
    }

    res.status(200).json(configData);
  } catch (error) {
    console.error('Error in config handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
