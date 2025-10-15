import { NextResponse } from 'next/server';
import { fetchEtaData } from '@/reader/functions/EtaData';
import { getConfig, getNames2Id } from '@/utils/cache';
import { EtaButtons, EtaPos } from '@/reader/functions/types-constants/EtaConstants';

export async function GET() {
  try {
    // Get both configs (cached or fresh)
    const [config, names2id] = await Promise.all([
        getConfig(),
        getNames2Id()
    ]);

    // Fetch ETA data
    const etaData = await fetchEtaData(config, names2id);

    // CRITICAL: Enforce button invariants at API level
    // Find currently active button (manual buttons have priority over AA)
    let activeButton: EtaButtons | null = null;
    
    // First, check for active manual buttons (HT, KT, GT, DT)
    for (const item of Object.values(etaData)) {
      if (Object.values(EtaButtons).includes(item.short as EtaButtons) && 
          item.value === EtaPos.EIN && 
          item.short !== EtaButtons.AA) {
        activeButton = item.short as EtaButtons;
        console.log(`[ETA API] Found active manual button: ${activeButton}`);
        break;
      }
    }
    
    // If no manual button found, check if AA is active
    if (!activeButton) {
      for (const item of Object.values(etaData)) {
        if (item.short === EtaButtons.AA && item.value === EtaPos.EIN) {
          activeButton = EtaButtons.AA;
          console.log(`[ETA API] AA is active`);
          break;
        }
      }
    }

    // If still no button found, default to AA
    if (!activeButton) {
      activeButton = EtaButtons.AA;
      console.log(`[ETA API] No button active, defaulting to AA`);
    }

    // Enforce invariant: Only ONE button can be active
    Object.entries(etaData).forEach(([uri, item]) => {
      if (Object.values(EtaButtons).includes(item.short as EtaButtons)) {
        if (item.short === activeButton) {
          // This is the active button - ensure it's ON
          etaData[uri] = {
            ...item,
            value: EtaPos.EIN
          };
        } else {
          // All other buttons must be OFF
          etaData[uri] = {
            ...item,
            value: EtaPos.AUS
          };
        }
      }
    });

    console.log(`[ETA API] Final active button: ${activeButton}`);

    return NextResponse.json({ success: true, data: etaData });
  } catch (error) {
    console.error('Error reading ETA data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read ETA data' },
      { status: 500 }
    );
  }
}
