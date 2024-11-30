import { NextResponse } from 'next/server';
import { fetchEtaData } from '@/reader/functions/EtaData';
import { getConfig, getNames2Id } from '@/utils/cache';

export async function GET() {
  try {
    // Get both configs (cached or fresh)
    const [config, names2id] = await Promise.all([
        getConfig(),
        getNames2Id()
    ]);

    // Fetch ETA data
    const etaData = await fetchEtaData(config, names2id);

    return NextResponse.json({ success: true, data: etaData });
  } catch (error) {
    console.error('Error reading ETA data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read ETA data' },
      { status: 500 }
    );
  }
}
