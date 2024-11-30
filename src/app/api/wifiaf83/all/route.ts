import { NextResponse } from 'next/server';
import { backgroundService, getServerStore } from '@/lib/backgroundService';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { getWifiAf83Data } from '@/utils/cache';

export async function GET() {
  try {
    // Get data from store first
    const store = getServerStore();
    const state = store.getState();
    const wifiData = state.wifiAf83.data;

    // If we have data in the store, return it
    if (wifiData?.allData) {
      return NextResponse.json({ 
        success: true, 
        data: wifiData.allData 
      });
    }

    // If no data in store, fetch it directly
    const wifiApi = new WifiAf83Api();
    const allData = await getWifiAf83Data(() => wifiApi.getAllRealtime());

    // Validate that we have the required data
    if (!allData.outdoor?.temperature?.value || !allData.indoor?.temperature?.value) {
      throw new Error('Invalid data structure');
    }

    return NextResponse.json({ 
      success: true, 
      data: allData
    });
  } catch (error) {
    console.error('Error in fetchAllWifiAf83Data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch all weather data' },
      { status: 500 }
    );
  }
}
