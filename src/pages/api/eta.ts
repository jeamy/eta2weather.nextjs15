import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { EtaData } from '@/reader/functions/types-constants/EtaConstants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const etaFilePath = path.join(process.cwd(), 'src', 'config', 'f_eta.json');

  try {
    const data = await fs.readFile(etaFilePath, 'utf-8');
    const etaData: EtaData = JSON.parse(data);
    res.status(200).json(etaData);
  } catch (error) {
    console.error('Error reading ETA data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
