import { NextRequest, NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig, getNames2Id } from '@/utils/cache';
import { requireWriteAccess } from '@/utils/apiAuth';
import { getServerStore } from '@/lib/backgroundService';
import { setHeatingCircuit } from '@/lib/heatingCircuit';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { isCircuitPosition } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { normalizeEtaVariableId } from '@/utils/etaIdentifiers';

export async function POST(request: NextRequest) {
  let etaApi: EtaApi | null = null;
  try {
    const authError = requireWriteAccess(request);
    if (authError) return authError;

    const body = await request.json().catch(() => null);
    const { id, expected, target } = body ?? {};
    if (typeof id !== 'string' || !normalizeEtaVariableId(id) ||
        !isCircuitPosition(expected) || !isCircuitPosition(target) || expected === target) {
      return NextResponse.json({ success: false, error: 'Ungültige Heizkreis-Anfrage' }, { status: 400 });
    }

    const [config, names2id] = await Promise.all([getConfig(), getNames2Id()]);
    const configuredId = names2id[EtaConstants.EIN_AUS_TASTE]?.id;
    if (!configuredId || normalizeEtaVariableId(configuredId) !== normalizeEtaVariableId(id)) {
      return NextResponse.json({ success: false, error: 'Die Heizkreis-ID hat sich geändert. Bitte neu laden.' }, { status: 409 });
    }
    etaApi = new EtaApi(config.s_eta);
    const store = getServerStore();
    const result = await setHeatingCircuit({
      etaApi, names2id, expected, target,
      onRead: (id, data) => {
        store.dispatch(storeEtaData({ ...store.getState().eta.data, [id]: data }));
      },
    });

    if (result.status === 'changed') {
      return NextResponse.json({
        success: false,
        error: 'Der Heizkreis-Zustand hat sich geändert. Bitte erneut prüfen.',
        data: result.data,
      }, { status: 409 });
    }
    if (result.status === 'uncertain') {
      return NextResponse.json({
        success: false,
        error: 'Der Schaltzustand konnte nicht bestätigt werden. Bitte an der ETA prüfen, bevor erneut geschaltet wird.',
        data: result.data,
      }, { status: 502 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[ETA heating-circuit] Request failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Heizkreis-Anfrage fehlgeschlagen',
    }, { status: 502 });
  } finally {
    etaApi?.dispose();
  }
}
