import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_names2id.json');

  try {
    const data = await fs.readFile(configFilePath, 'utf-8');
    const names2IdData: Names2Id = JSON.parse(data);
    res.status(200).json(names2IdData);
  } catch (error) {
    console.error('Error reading Names2Id data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
