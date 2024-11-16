import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '@/reader/functions/types-constants/ConfigConstants';
import { fetchWifiAf83Data } from '@/reader/functions/WifiAf83Data';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read config file
    const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: Config = JSON.parse(configData);

    // Fetch WifiAf83 data
    const wifiAf83Data = await fetchWifiAf83Data(config);
    console.log('WifiAf83 data:', wifiAf83Data);
    // Return both WifiAf83 data and config
    res.status(200).json({
      data: wifiAf83Data,
      config: config
    });
  } catch (error) {
    console.error('Error fetching WifiAf83 data:', error);
    res.status(500).json({ error: 'Failed to fetch WifiAf83 data' });
  }
}
