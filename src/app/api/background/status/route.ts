import { NextResponse } from 'next/server';
import { getServerStore } from '@/lib/backgroundService';

export async function GET() {
  try {
    const store = getServerStore();
    const state = store.getState();

    return NextResponse.json({
      success: true,
      data: {
        config: state.config.data,
        eta: state.eta.data,
        wifiAf83: state.wifiAf83.data,
        names2Id: state.names2Id.data
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
