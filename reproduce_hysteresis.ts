
import { determineControlAction, ControlInput, ControlState } from './src/lib/controlLogic';
import { EtaButtons } from './src/reader/functions/types-constants/EtaConstants';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function runTests() {
    console.log('Running Hysteresis Tests...');

    const baseState: ControlState = {
        wasBelow: false,
        wasSliderNegative: false,
        manualOverride: false,
        manualOverrideTime: null
    };

    const minTemp = 20.0;
    const hysteresis = 0.2;

    const baseInput: ControlInput = {
        indoorTemp: 21,
        minTemp: minTemp,
        sliderPos: 0,
        currentActiveButton: EtaButtons.AA,
        lastTempState: baseState,
        manualOverrideDurationMs: 3600000,
        currentTime: 1000000
    };

    // Test 1: Drop below minTemp -> Switch to KT
    console.log('\nTest 1: Drop below minTemp');
    {
        const input = { ...baseInput, indoorTemp: 19.9 };
        const result = determineControlAction(input);
        assert(result.action === 'SWITCH_BUTTON', 'Should switch button');
        assert(result.targetButton === EtaButtons.KT, 'Should target KT');
        assert(result.newState.wasBelow === true, 'Should set wasBelow = true');
    }

    // Test 2: Rise slightly above minTemp (within hysteresis) -> Stay KT
    console.log('\nTest 2: Rise slightly above minTemp (within hysteresis)');
    {
        // Simulate that we were already heating
        const stateHeating: ControlState = { ...baseState, wasBelow: true };
        // Temp is 20.1 (minTemp 20.0). Without hysteresis, this would switch to AA. With hysteresis (0.2), it should stay KT.
        const input = {
            ...baseInput,
            indoorTemp: 20.1,
            currentActiveButton: EtaButtons.KT, // We are currently heating
            lastTempState: stateHeating
        };
        const result = determineControlAction(input);

        // Current logic (without hysteresis) will likely switch to AA (action: SWITCH_BUTTON, target: AA)
        // Desired logic: action: NONE (stay on KT)
        if (result.action === 'NONE') {
            console.log('✅ PASS: Stayed on KT (Hysteresis working)');
        } else if (result.action === 'SWITCH_BUTTON' && result.targetButton === EtaButtons.AA) {
            console.error('❌ FAIL: Switched to AA (Hysteresis NOT working)');
        } else {
            console.error(`❌ FAIL: Unexpected action ${result.action}`);
        }
    }

    // Test 3: Rise above hysteresis -> Switch to AA
    console.log('\nTest 3: Rise above hysteresis');
    {
        const stateHeating: ControlState = { ...baseState, wasBelow: true };
        // Temp is 20.3 (minTemp 20.0 + 0.2 = 20.2). Should switch to AA.
        const input = {
            ...baseInput,
            indoorTemp: 20.3,
            currentActiveButton: EtaButtons.KT,
            lastTempState: stateHeating
        };
        const result = determineControlAction(input);
        assert(result.action === 'SWITCH_BUTTON', 'Should switch button');
        assert(result.targetButton === EtaButtons.AA, 'Should target AA');
        assert(result.newState.wasBelow === false, 'Should set wasBelow = false');
    }
}

runTests();
