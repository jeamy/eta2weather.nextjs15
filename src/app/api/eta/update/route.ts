import { NextRequest, NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig, getNames2Id } from '@/utils/cache';
import { requireWriteAccess } from '@/utils/apiAuth';
import { getHeatingButtonIds } from '@/lib/heatingMode';
import { normalizeEtaVariableId } from '@/utils/etaIdentifiers';

export async function POST(request: NextRequest) {
  let etaApi: EtaApi | null = null;

  try {
    const authError = requireWriteAccess(request);
    if (authError) return authError;

    // Get config from cache
    const config = await getConfig();
    const body = await request.json();
    const { id, value, begin = "0", end = "0" } = body;

    if (typeof id !== 'string' || !id.trim() || value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const normalizedId = normalizeEtaVariableId(id);
    if (!normalizedId) {
      return NextResponse.json({ error: 'Invalid ETA variable id' }, { status: 400 });
    }
    const modeIds = Object.values(getHeatingButtonIds(await getNames2Id()));
    if (modeIds.some(modeId => normalizeEtaVariableId(modeId) === normalizedId)) {
      return NextResponse.json(
        { error: 'Heating mode buttons must be changed through the heating-mode endpoint' },
        { status: 400 }
      );
    }

    if (!config.s_eta) {
      return NextResponse.json(
        { error: 'ETA server address not configured' },
        { status: 500 }
      );
    }

    etaApi = new EtaApi(config.s_eta);
    const result = await etaApi.setUserVar(normalizedId, String(value), String(begin), String(end));

    if (result.error) {
      console.error('ETA API error result:', result);
      return NextResponse.json(
        { error: `ETA API error: ${result.error}` },
        { status: 500 }
      );
    }

    if (!result.result) {
      console.error('No result from ETA API');
      return NextResponse.json(
        { error: 'No response from ETA API' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.result });
  } catch (error) {
    console.error('Error in eta/update:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update ETA data' },
      { status: 500 }
    );
  } finally {
    etaApi?.dispose();
  }
}
