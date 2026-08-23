import { NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig } from '@/utils/cache';
import { parseEtaMenuXml } from '@/reader/functions/etaMenuParser';

const MENU_CACHE_TTL_MS = 60 * 60 * 1000;
let menuCache: { server: string; timestamp: number; data: ReturnType<typeof parseEtaMenuXml> } | null = null;
let menuRequest: { server: string; promise: Promise<ReturnType<typeof parseEtaMenuXml>> } | null = null;

async function getMenu(server: string) {
    if (menuCache && menuCache.server === server && Date.now() - menuCache.timestamp < MENU_CACHE_TTL_MS) {
        return menuCache.data;
    }
    if (menuRequest?.server === server) {
        return menuRequest.promise;
    }

    const etaApi = new EtaApi(server);
    const promise = (async () => {
        try {
            const menuResponse = await etaApi.getMenu();
            if (menuResponse.error || !menuResponse.result?.trim()) {
                throw new Error(menuResponse.error || 'No menu data received');
            }
            const data = parseEtaMenuXml(menuResponse.result.trim());
            menuCache = { server, timestamp: Date.now(), data };
            return data;
        } finally {
            etaApi.dispose();
            if (menuRequest?.server === server) menuRequest = null;
        }
    })();
    menuRequest = { server, promise };
    return promise;
}

export async function GET() {
    try {
        const config = await getConfig();
        return NextResponse.json({ success: true, data: await getMenu(config.s_eta) });
    } catch (error) {
        console.error('Error in eta/menu:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch menu data' },
            { status: 503 }
        );
    }
}
