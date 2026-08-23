import { NextRequest, NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { ETA_MODE_BUTTONS, EtaButtons, EtaData, EtaModeButton, EtaPos, EtaText } from '@/reader/functions/types-constants/EtaConstants';
import { getConfig, getNames2Id } from '@/utils/cache';
import { setHeatingMode } from '@/lib/heatingMode';
import { requireWriteAccess } from '@/utils/apiAuth';
import { BackgroundService, getServerStore } from '@/lib/backgroundService';
import { storeData as storeEtaData } from '@/redux/etaSlice';

function isEtaModeButton(value: unknown): value is EtaModeButton {
  return typeof value === 'string' && ETA_MODE_BUTTONS.includes(value as EtaModeButton);
}

const BUTTON_LABELS: Record<EtaModeButton, string> = {
  [EtaButtons.HT]: 'Heizen Taste',
  [EtaButtons.KT]: 'Kommen Taste',
  [EtaButtons.AA]: 'Autotaste',
  [EtaButtons.GT]: 'Gehen Taste',
  [EtaButtons.DT]: 'Absenken Taste',
};

function getButtonStatus(etaData: EtaData) {
  const status: Record<string, string> = {};
  for (const item of Object.values(etaData || {})) {
    if (!isEtaModeButton(item.short)) continue;
    status[item.short] = item.strValue || item.value || '';
  }
  return status;
}

export async function POST(request: NextRequest) {
  let etaApi: EtaApi | null = null;

  try {
    const authError = requireWriteAccess(request);
    if (authError) return authError;

    const body = await request.json();
    const targetButton = body?.targetButton;
    const isManual = Boolean(body?.isManual);
    if (!isEtaModeButton(targetButton)) {
      return NextResponse.json(
        { success: false, error: 'Invalid targetButton' },
        { status: 400 }
      );
    }

    console.info('[ETA heating-mode] Toggle requested', {
      targetButton,
      label: BUTTON_LABELS[targetButton],
      isManual,
    });

    const [config, names2id] = await Promise.all([getConfig(), getNames2Id()]);
    const store = getServerStore();
    const etaDataBefore = { ...store.getState().eta.data };
    console.info('[ETA heating-mode] Current button status before toggle', {
      targetButton,
      status: getButtonStatus(etaDataBefore),
    });

    etaApi = new EtaApi(config.s_eta);
    const buttonIds = await setHeatingMode({
      targetButton,
      names2id,
      etaApi,
    });

    const etaData = { ...store.getState().eta.data };
    for (const [button, uri] of Object.entries(buttonIds)) {
      if (!etaData[uri]) continue;
      const isActive = button === targetButton;
      etaData[uri] = {
        ...etaData[uri],
        value: isActive ? EtaPos.EIN : EtaPos.AUS,
        strValue: isActive ? EtaText.EIN : EtaText.AUS,
      };
    }
    store.dispatch(storeEtaData(etaData));
    if (isManual) {
      BackgroundService.getInstance().setManualOverride(targetButton !== EtaButtons.AA);
    }

    console.info('[ETA heating-mode] Current button status after toggle', {
      targetButton,
      status: getButtonStatus(etaData),
    });

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
