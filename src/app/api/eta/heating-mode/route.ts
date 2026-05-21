import { NextRequest, NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaButtons, EtaPos, EtaText } from '@/reader/functions/types-constants/EtaConstants';
import { getConfig, getNames2Id } from '@/utils/cache';
import { HeatingButtonFlags, setHeatingMode } from '@/lib/heatingMode';
import { requireWriteAccess } from '@/utils/apiAuth';
import { getServerStore } from '@/lib/backgroundService';
import { storeData as storeEtaData } from '@/redux/etaSlice';

function isEtaButton(value: unknown): value is EtaButtons {
  return typeof value === 'string' && Object.values(EtaButtons).includes(value as EtaButtons);
}

const BUTTON_LABELS: Record<EtaButtons, string> = {
  [EtaButtons.EAT]: 'Ein/Aus Taste',
  [EtaButtons.HT]: 'Heizen Taste',
  [EtaButtons.KT]: 'Kommen Taste',
  [EtaButtons.AA]: 'Autotaste',
  [EtaButtons.GT]: 'Gehen Taste',
  [EtaButtons.DT]: 'Absenken Taste',
};

export async function POST(request: NextRequest) {
  let etaApi: EtaApi | null = null;

  try {
    const authError = requireWriteAccess(request);
    if (authError) return authError;

    const body = await request.json();
    const targetButton = body?.targetButton;
    const activeFlags = body?.activeFlags as HeatingButtonFlags | undefined;
    const isManual = Boolean(body?.isManual);
    if (!isEtaButton(targetButton)) {
      return NextResponse.json(
        { success: false, error: 'Invalid targetButton' },
        { status: 400 }
      );
    }

    console.info('[ETA heating-mode] Toggle requested', {
      targetButton,
      label: BUTTON_LABELS[targetButton],
      isManual,
      activeFlags: activeFlags ?? null,
    });

    const [config, names2id] = await Promise.all([getConfig(), getNames2Id()]);
    etaApi = new EtaApi(config.s_eta);
    const buttonIds = await setHeatingMode({
      targetButton,
      names2id,
      etaApi,
      activeFlags,
    });

    const store = getServerStore();
    const etaData = { ...store.getState().eta.data };
    for (const [button, uri] of Object.entries(buttonIds)) {
      if (!etaData[uri]) continue;
      const isActive = button === targetButton;
      const shouldStayOn = targetButton !== EtaButtons.EAT && button === EtaButtons.EAT;
      etaData[uri] = {
        ...etaData[uri],
        value: isActive || shouldStayOn ? EtaPos.EIN : EtaPos.AUS,
        strValue: isActive || shouldStayOn ? EtaText.EIN : EtaText.AUS,
      };
    }
    store.dispatch(storeEtaData(etaData));

    console.info('[ETA heating-mode] Toggle applied', {
      targetButton,
      label: BUTTON_LABELS[targetButton],
      activeButton: targetButton,
      buttonIds,
    });

    return NextResponse.json({ success: true, targetButton, buttonIds });
  } catch (error) {
    console.error('[ETA heating-mode] Toggle failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update heating mode' },
      { status: 500 }
    );
  } finally {
    etaApi?.dispose();
  }
}
