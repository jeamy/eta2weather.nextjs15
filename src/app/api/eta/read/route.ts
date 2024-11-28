import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '@/reader/functions/types-constants/ConfigConstants';
import { fetchEtaData } from '@/reader/functions/EtaData';
import { EtaData } from '@/reader/functions/types-constants/EtaConstants';
import { Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export async function GET() {
  try {
    // Read config file
    const configFile = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
    const configData = await fs.readFile(configFile, 'utf8');
    const config: Config = JSON.parse(configData);

    // Read names2id file
    const names2idFile = path.join(process.cwd(), 'src', 'config', 'f_names2id.json');
    const names2idData = await fs.readFile(names2idFile, 'utf8');
    const names2id: Names2Id = JSON.parse(names2idData);

    // Fetch ETA data
    const etaData: EtaData = await fetchEtaData(config, names2id);

    return NextResponse.json({ success: true, data: etaData });
  } catch (error) {
    console.error('Error in eta/read:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read ETA data' },
      { status: 500 }
    );
  }
}
