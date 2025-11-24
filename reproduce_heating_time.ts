import { checkHeatingTime } from './src/utils/etaUtils';

// Mock interfaces to avoid import issues
interface MenuNode {
    name: string;
    uri?: string;
    children?: MenuNode[];
}

interface ParsedXmlData {
    strValue?: string;
    value: string;
    unit: string;
    scaleFactor?: string;
    advTextOffset?: string;
    id?: string;
    parentId?: string;
    [key: string]: any;
}

// Mock data helpers
const createTimeWindowNode = (name: string, uri: string): MenuNode => ({
    name,
    uri,
    children: []
});

const createDayNode = (name: string, windows: MenuNode[]): MenuNode => ({
    name,
    uri: `/120/10101/0/0/${name}`, // Fake URI
    children: windows
});

const createHeizzeitenNode = (days: MenuNode[]): MenuNode => ({
    name: 'Heizzeiten',
    uri: '/120/10101/0/0/12113/0/0',
    children: days
});

// Test scenarios
function runTests() {
    console.log('Running checkHeatingTime reproduction tests...');

    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const currentDayName = days[new Date().getDay()];
    console.log(`Current day: ${currentDayName}`);

    // Scenario 1: Standard naming "Zeitfenster 1" - Should work
    {
        const window1 = createTimeWindowNode('Zeitfenster 1', '/120/10101/0/0/12113/0/0/1');
        const dayNode = createDayNode(currentDayName, [window1]);
        const menuNodes = [createHeizzeitenNode([dayNode])];

        // Set time to be inside the window (e.g., 00:00 - 23:59 to cover everything)
        const values: Record<string, ParsedXmlData> = {
            '/120/10101/0/0/12113/0/0/1': {
                strValue: '00:00 - 23:59',
                unit: '',
                value: '0',
                scaleFactor: '1',
                advTextOffset: '0',
                id: '1',
                parentId: '0'
            }
        };

        const result = checkHeatingTime(menuNodes as any, values as any);
        console.log(`Scenario 1 (Standard "Zeitfenster 1"): ${result ? 'PASS' : 'FAIL'} (Expected: true)`);
    }

    // Scenario 2: Naming with extra text "Zeitfenster 1 (Mo-Fr)" - Might fail
    {
        const window1 = createTimeWindowNode('Zeitfenster 1 (Mo-Fr)', '/120/10101/0/0/12113/0/0/1');
        const dayNode = createDayNode(currentDayName, [window1]);
        const menuNodes = [createHeizzeitenNode([dayNode])];

        const values: Record<string, ParsedXmlData> = {
            '/120/10101/0/0/12113/0/0/1': {
                strValue: '00:00 - 23:59',
                unit: '',
                value: '0',
                scaleFactor: '1',
                advTextOffset: '0',
                id: '1',
                parentId: '0'
            }
        };

        const result = checkHeatingTime(menuNodes as any, values as any);
        console.log(`Scenario 2 (Extra text "Zeitfenster 1 (Mo-Fr)"): ${result ? 'PASS' : 'FAIL'} (Expected: true if regex allows)`);
    }

    // Scenario 3: Multiple windows, one active
    {
        const window1 = createTimeWindowNode('Zeitfenster 1', '/w1');
        const window2 = createTimeWindowNode('Zeitfenster 2', '/w2');
        const window3 = createTimeWindowNode('Zeitfenster 3', '/w3');
        const dayNode = createDayNode(currentDayName, [window1, window2, window3]);
        const menuNodes = [createHeizzeitenNode([dayNode])];

        // Current time
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();

        // Window 1: Past
        const pastStart = `${(h - 2).toString().padStart(2, '0')}:00`;
        const pastEnd = `${(h - 1).toString().padStart(2, '0')}:00`;

        // Window 2: Active
        const activeStart = `${h.toString().padStart(2, '0')}:00`;
        const activeEnd = `${(h + 1).toString().padStart(2, '0')}:00`;

        // Window 3: Future
        const futureStart = `${(h + 2).toString().padStart(2, '0')}:00`;
        const futureEnd = `${(h + 3).toString().padStart(2, '0')}:00`;

        const values: Record<string, ParsedXmlData> = {
            '/w1': { strValue: `${pastStart} - ${pastEnd}`, unit: '', value: '0', scaleFactor: '1', advTextOffset: '0', id: '1', parentId: '0' },
            '/w2': { strValue: `${activeStart} - ${activeEnd}`, unit: '', value: '0', scaleFactor: '1', advTextOffset: '0', id: '2', parentId: '0' },
            '/w3': { strValue: `${futureStart} - ${futureEnd}`, unit: '', value: '0', scaleFactor: '1', advTextOffset: '0', id: '3', parentId: '0' },
        };

        const result = checkHeatingTime(menuNodes as any, values as any);
        console.log(`Scenario 3 (Multiple windows, one active): ${result ? 'PASS' : 'FAIL'} (Expected: true)`);
    }
}

runTests();
