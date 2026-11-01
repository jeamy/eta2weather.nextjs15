import { NextResponse } from 'next/server';
import { BackgroundService, getServerStore } from '@/lib/backgroundService';

export async function GET() {
  try {
    const store = getServerStore();
    const state = store.getState();

    // Only include WiFi data if it has been initialized (time > 0)
    const wifiData = state.wifiAf83.data;
    const hasValidWifiData = wifiData.time > 0;
    const eta = state.eta.data || {};
    const freshness = BackgroundService.getInstance().getDataFreshness();
    const etaEntryCount = Object.keys(eta).length;

    return NextResponse.json({
      success: true,
      data: {
        config: state.config.data,
        eta,
        // Only send WiFi data if it's been initialized
        wifiAf83: hasValidWifiData ? { ...wifiData, stale: !freshness.wifiFresh } : undefined,
        names2Id: state.names2Id.data,
        control: BackgroundService.getInstance().getControlStatus(),
        diagnostics: {
          etaEntryCount,
          hasValidWifiData,
          ...freshness
        }
      }
    });
  } catch (error) {
    console.error('Error getting background service status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
