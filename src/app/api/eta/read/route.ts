import { NextResponse } from 'next/server';
import { getServerStore } from '@/lib/backgroundService';
import { fetchEtaData } from '@/reader/functions/EtaData';
import { getConfig, getNames2Id } from '@/utils/cache';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { normalizeEtaButtonState } from '@/lib/etaModeState';

export async function GET() {
  try {
    const store = getServerStore();
    const state = store.getState();
    let etaData = { ...state.eta.data };

    if (Object.keys(etaData).length === 0) {
      const config = await getConfig();
      etaData = await fetchEtaData(config, await getNames2Id());
      if (Object.keys(etaData).length > 0) {
        store.dispatch(storeEtaData(etaData));
      }
    }

    etaData = normalizeEtaButtonState(etaData);

    return NextResponse.json({ success: true, data: etaData, config: state.config.data });
  } catch (error) {
    console.error('Error reading ETA data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read ETA data' },
      { status: 500 }
    );
  }
}
