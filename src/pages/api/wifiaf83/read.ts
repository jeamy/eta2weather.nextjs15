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
    // Fetch WifiAf83 data
    const wifiAf83Data = await fetchWifiAf83Data();
    // console.log('WifiAf83 data:', wifiAf83Data);
    res.status(200).json({
      data: wifiAf83Data,
    });
  } catch (error) {
    console.error('Error fetching WifiAf83 data:', error);
    res.status(500).json({ error: 'Failed to fetch WifiAf83 data' });
  }
}
