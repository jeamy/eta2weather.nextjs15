import { NextRequest, NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig } from '@/utils/cache';

function normalizeId(rawId: string): string {
  if (!rawId) {
    return rawId;
  }

  let id = rawId.trim();

  // If a full URL was passed accidentally, extract the path part
  if (id.startsWith('http')) {
    try {
      const url = new URL(id);
      id = url.pathname || id;
    } catch {
      // Ignore URL parsing errors and fall back to the original id
    }
  }

  // Strip query string / hash if present
  id = id.split('?')[0].split('#')[0];

  // If the ID already contains the user/var prefix, remove it so EtaApi can add it once
  id = id.replace(/^\/?user\/var\/+/, '/');

  // Ensure the ID starts with a single leading slash (EtaApi will remove it internally)
  if (!id.startsWith('/')) {
    id = `/${id}`;
  }

  return id;
}

export async function POST(request: NextRequest) {
  try {
    // Get config from cache
    const config = await getConfig();
    console.log(`[API] Loaded config s_eta: ${config.s_eta}`);

    const body = await request.json();
    const { id, value, begin = "0", end = "0" } = body;
    const normalizedId = normalizeId(id);

    console.log(`Setting value for ID ${normalizedId} (raw: ${id}) to value: ${value}, begin: ${begin}, end: ${end}`);

    if (!normalizedId || !value) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (!config.s_eta) {
      return NextResponse.json(
        { error: 'ETA server address not configured' },
        { status: 500 }
      );
    }

    const etaApi = new EtaApi(config.s_eta);
    const result = await etaApi.setUserVar(normalizedId, value, begin, end);

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
  }
}
