import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '@/reader/functions/types-constants/ConfigConstants';
import { EtaApi } from '@/reader/functions/EtaApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read config file
    const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: Config = JSON.parse(configData);

    const { id, value, begin = "0", end = "0" } = req.body;

    if (!id || !value) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const etaApi = new EtaApi(config.s_eta);
    const result = await etaApi.setUserVar(id, value, begin, end);

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.status(200).json({ result: result.result });
  } catch (error) {
    console.error('Error updating ETA value:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
