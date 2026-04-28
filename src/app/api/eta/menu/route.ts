import { NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig } from '@/utils/cache';
import { parseEtaMenuXml } from '@/reader/functions/etaMenuParser';

export async function GET() {
    try {
        // Get config using cache
        const config = await getConfig();

        // Create EtaApi instance
        const etaApi = new EtaApi(config.s_eta);

        // Get menu XML
        const menuResponse = await etaApi.getMenu();
        
        if (menuResponse.error || !menuResponse.result) {
            console.error('Error fetching menu:', menuResponse.error);
            return NextResponse.json(
                { success: false, error: menuResponse.error || 'No menu data received' },
                { status: 503 }  // Service Unavailable
            );
        }

        // Ensure we have valid XML data before parsing
        const xmlData = menuResponse.result.trim();
        if (!xmlData) {
            return NextResponse.json(
                { success: false, error: 'Empty menu data received' },
                { status: 500 }
            );
        }

        // Parse the menu XML
        const menu = parseEtaMenuXml(xmlData);
        
        return NextResponse.json({ success: true, data: menu });
    } catch (error) {
        console.error('Error in eta/menu:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch menu data' },
            { status: 500 }
        );
    }
}
