import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '@/reader/functions/types-constants/ConfigConstants';
import { fetchEtaData } from '@/reader/functions/EtaData';
import { EtaData } from '@/reader/functions/types-constants/EtaConstants';
import { Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read config file
    const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: Config = JSON.parse(configData);

    // Read names2id file
    const names2idPath = path.join(process.cwd(), 'src', 'config', config.f_names2id);
    const names2idData = await fs.readFile(names2idPath, 'utf-8');
    const names2id: Names2Id = JSON.parse(names2idData);

    const etaData: EtaData = await fetchEtaData(config, names2id);
    
    // Update config file with any changes
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    // Return both ETA data and updated config
    res.status(200).json({
      data: etaData,
      config: config
    });
  } catch (error) {
    console.error('Error fetching ETA data:', error);
    res.status(500).json({ error: 'Failed to fetch ETA data' });
  }
}
