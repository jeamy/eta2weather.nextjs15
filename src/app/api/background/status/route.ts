import { NextResponse } from 'next/server';
import { getServerStore } from '@/lib/backgroundService';
import { ETA_MODE_BUTTONS, EtaModeButton, EtaButtons, EtaData, EtaPos, EtaText } from '@/reader/functions/types-constants/EtaConstants';

function normalizeEtaButtonState(etaData: EtaData): EtaData {
  const normalized = { ...etaData };
  let activeButton: EtaButtons | null = null;

  for (const item of Object.values(normalized)) {
    if (
      ETA_MODE_BUTTONS.includes(item.short as EtaModeButton) &&
      item.value === EtaPos.EIN &&
      item.short !== EtaButtons.AA
    ) {
      activeButton = item.short as EtaButtons;
      break;
    }
  }

  if (!activeButton) {
    for (const item of Object.values(normalized)) {
      if (item.short === EtaButtons.AA && item.value === EtaPos.EIN) {
        activeButton = EtaButtons.AA;
        break;
      }
    }
  }

  activeButton ??= EtaButtons.AA;

  for (const [uri, item] of Object.entries(normalized)) {
    if (!ETA_MODE_BUTTONS.includes(item.short as EtaModeButton)) {
      continue;
    }
    const isActive = item.short === activeButton;
    normalized[uri] = {
      ...item,
      value: isActive ? EtaPos.EIN : EtaPos.AUS,
      strValue: isActive ? EtaText.EIN : EtaText.AUS,
    };
  }

  return normalized;
}

export async function GET() {
  try {
    const store = getServerStore();
    const state = store.getState();

    // Only include WiFi data if it has been initialized (time > 0)
    const wifiData = state.wifiAf83.data;
    const hasValidWifiData = wifiData.time > 0;
    const eta = normalizeEtaButtonState(state.eta.data || {});
    const etaEntryCount = Object.keys(eta).length;

    return NextResponse.json({
      success: true,
      data: {
        config: state.config.data,
        eta,
        // Only send WiFi data if it's been initialized
        wifiAf83: hasValidWifiData ? wifiData : undefined,
        names2Id: state.names2Id.data,
        diagnostics: {
          etaEntryCount,
          hasValidWifiData
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
