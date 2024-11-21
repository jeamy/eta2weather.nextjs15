import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '@/reader/functions/types-constants/ConfigConstants';
import { EtaApi } from '@/reader/functions/EtaApi';

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

        // Only process opening tags for fub and object
        if (line.includes('<fub') || line.includes('<object')) {
            const currentDepth = getDepthLevel(line);
            const node: MenuNode = {
                uri: getAttributeValue(line, 'uri'),
                name: getAttributeValue(line, 'name')
            };

            // Pop any items from the stack that are at a greater or equal depth
            while (stack.length > 0 && stack[stack.length - 1].depth >= currentDepth) {
                stack.pop();
            }

            if (stack.length > 0) {
                // Add as child to the last item on the stack
                const parent = stack[stack.length - 1].node;
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(node);
            } else if (line.includes('<fub')) {
                // Only add top-level fub nodes to the result
                result.push(node);
            }

            stack.push({ node, depth: currentDepth });
        }
    }

    return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the ETA server address from config
        const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);

        const etaApi = new EtaApi(config.etaServer);
        const menuResponse = await etaApi.getMenu();

        if (!menuResponse.result) {
            throw new Error('No menu data received');
        }

//        console.log('Parsing menu XML...');
        
        // Save raw XML for reference
        const menuPathX = path.join(process.cwd(), 'src', 'config', 'f_etamenu.xml');
        await fs.writeFile(menuPathX, menuResponse.result.toString(), 'utf-8');

        // Parse XML to JSON
        const menuData = parseMenuXML(menuResponse.result);

        // console.log(menuData);
        
        // Save parsed JSON
        const menuPath = path.join(process.cwd(), 'src', 'config', 'f_etamenu.json');
        await fs.writeFile(menuPath, JSON.stringify(menuData, null, 2), 'utf-8');

        // Count total nodes
        const countNodes = (nodes: MenuNode[]): number => {
            return nodes.reduce((count, node) => {
                return count + 1 + (node.children ? countNodes(node.children) : 0);
            }, 0);
        };

        const totalNodes = countNodes(menuData);

        console.log("Total nodes:", totalNodes);
        console.log("Sending menu data:", menuData);

        return res.status(200).json({
            success: true,
            data: menuData,
            stats: {
                totalNodes,
                topLevelNodes: menuData.length
            }
        });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
}
