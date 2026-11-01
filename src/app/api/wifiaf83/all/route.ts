import { NextResponse } from 'next/server';
import { BackgroundService, getServerStore } from '@/lib/backgroundService';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { getConfig, getWifiAf83Data } from '@/utils/cache';
import { parseNum } from '@/utils/numberParser';
import { getFreshWifiMeasurementTime, getMaxFreshDataAge } from '@/lib/controlFreshness';

export async function GET(request: Request) {
  let wifiApi: WifiAf83Api | null = null;

  try {
    // Get data from store first
    const store = getServerStore();
    const state = store.getState();
    const wifiData = state.wifiAf83.data;

    // If we have data in the store, return it
    if (wifiData?.allData) {
      return NextResponse.json({ 
        success: true, 
        data: wifiData.allData,
        stale: !BackgroundService.getInstance().getDataFreshness().wifiFresh,
      });
    }

    // If no data in store, fetch it directly
    const api = new WifiAf83Api();
    wifiApi = api;
    let fallback = false;
    const allData = await getWifiAf83Data((s) => api.getAllRealtime(s), request.signal, {
      onFallback: () => { fallback = true; },
    });

    // Validate that we have the required data
    if (parseNum(allData.outdoor?.temperature?.value) === null || parseNum(allData.indoor?.temperature?.value) === null) {
      throw new Error('Invalid data structure');
    }

    const config = await getConfig();
    const fresh = getFreshWifiMeasurementTime(
      allData.outdoor?.temperature?.time, allData.indoor?.temperature?.time,
      Date.now(), getMaxFreshDataAge(config.t_update_timer, 600000),
    );
    return NextResponse.json({ 
      success: true, 
      data: allData,
      stale: fallback || fresh === null,
    });
  } catch (error) {
    console.error('Error in fetchAllWifiAf83Data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch all weather data' },
      { status: 500 }
    );
  } finally {
    wifiApi?.dispose();
  }
}
