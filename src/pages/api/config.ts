import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '@/reader/functions/types-constants/ConfigConstants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

  try {
    const data = await fs.readFile(configFilePath, 'utf-8');
    const configData: Config = JSON.parse(data);
    res.status(200).json(configData);
  } catch (error) {
    console.error('Error reading config data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
