const fs = require('fs').promises;
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const { EtaApi } = require('../reader/functions/EtaApi');

async function parseMenuXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    function parseNode(node) {
        const menuNode = {
            id: node.getAttribute('id') || '',
            name: node.getAttribute('name') || '',
            type: node.getAttribute('type') || ''
        };

        const childNodes = Array.from(node.getElementsByTagName('node'));
        if (childNodes.length > 0) {
            menuNode.children = childNodes.map(child => parseNode(child));
        }

        return menuNode;
    }

    const rootNodes = Array.from(xmlDoc.getElementsByTagName('node'));
    return rootNodes.map(node => parseNode(node));
}

async function fetchMenu() {
    try {
        // Read config file to get ETA server address
        const configPath = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);

        // Create EtaApi instance and fetch menu
        const etaApi = new EtaApi(config.s_eta);
        console.log('Fetching menu from ETA server...');
        const menuResponse = await etaApi.getMenu();

        if (menuResponse.error) {
            throw new Error(menuResponse.error);
        }

        if (!menuResponse.result) {
            throw new Error('No menu data received');
        }

        console.log('Parsing menu XML...');
        const menuData = await parseMenuXML(menuResponse.result);

        // Save to file
        const menuPath = path.join(process.cwd(), 'src', 'config', 'f_etamenu.json');
        await fs.writeFile(menuPath, JSON.stringify(menuData, null, 2), 'utf-8');
        console.log(`Menu data saved to ${menuPath}`);

        // Print some statistics
        const countNodes = (nodes) => {
            return nodes.reduce((count, node) => {
                return count + 1 + (node.children ? countNodes(node.children) : 0);
            }, 0);
        };

        console.log(`Total nodes in menu: ${countNodes(menuData)}`);
        console.log('Root level nodes:', menuData.map(node => node.name).join(', '));

    } catch (error) {
        console.error('Error fetching ETA menu:', error);
        process.exit(1);
    }
}

fetchMenu();
