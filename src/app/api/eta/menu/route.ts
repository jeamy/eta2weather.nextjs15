import { NextResponse } from 'next/server';
import { EtaApi } from '@/reader/functions/EtaApi';
import { getConfig } from '@/utils/cache';

interface MenuNode {
    uri: string;
    name: string;
    children?: MenuNode[];
}

function parseMenuXML(xmlString: string): MenuNode[] {
    // Helper function to extract attribute value
    function getAttributeValue(line: string, attr: string): string {
        const match = line.match(new RegExp(`${attr}="([^"]+)"`));
        return match ? match[1] : '';
    }

    // Helper function to get the depth level of a line
    function getDepthLevel(line: string): number {
        return (line.match(/^\s*/)?.[0].length || 0) / 1;
    }

    const lines = xmlString.split('\n');
    const result: MenuNode[] = [];
    const stack: { node: MenuNode; depth: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim() || line.includes('<?xml') || line.includes('</eta>') || line.includes('<eta')) {
            continue;
        }

        const currentDepth = getDepthLevel(line);
        const uri = getAttributeValue(line, 'uri');
        const name = getAttributeValue(line, 'name');

        if (!uri || !name) {
            continue;
        }

        const node: MenuNode = { uri, name };

        // Pop items from stack if we're at a lower or same depth
        while (stack.length > 0 && stack[stack.length - 1].depth >= currentDepth) {
            stack.pop();
        }

        if (stack.length > 0) {
            // Add as child to the last item in stack
            const parent = stack[stack.length - 1].node;
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(node);
        } else {
            // Add to root level
            result.push(node);
        }

        // Add current node to stack
        stack.push({ node, depth: currentDepth });
    }

    return result;
}

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
        const menu = parseMenuXML(xmlData);
        
        return NextResponse.json({ success: true, data: menu });
    } catch (error) {
        console.error('Error in eta/menu:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch menu data' },
            { status: 500 }
        );
    }
}
