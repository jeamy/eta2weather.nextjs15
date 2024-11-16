import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { WifiAF83Data } from '@/reader/functions/types-constants/WifiAf83';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const wifiFilePath = path.join(process.cwd(), 'src', 'config', 'f_wifiaf89.json');

  try {
    const data = await fs.readFile(wifiFilePath, 'utf-8');
    const wifiData: WifiAF83Data = JSON.parse(data);
    res.status(200).json(wifiData);
  } catch (error) {
    console.error('Error reading WiFi data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
