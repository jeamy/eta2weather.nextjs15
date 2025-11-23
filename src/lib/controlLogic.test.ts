import { determineControlAction, ControlInput, ControlState } from './controlLogic';
import { EtaButtons } from '@/reader/functions/types-constants/EtaConstants';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

function runTests() {
    console.log('Running Control Logic Tests...');

    const baseState: ControlState = {
        wasBelow: false,
        wasSliderNegative: false,
        manualOverride: false,
        manualOverrideTime: null
    };

    const baseInput: ControlInput = {
        indoorTemp: 21,
        minTemp: 20,
        sliderPos: 0,
        currentActiveButton: EtaButtons.AA,
        lastTempState: baseState,
        manualOverrideDurationMs: 3600000,
        currentTime: 1000000
    };

    // Test 1: Normal operation (No change)
    {
        const result = determineControlAction(baseInput);
        assert(result.action === 'NONE', 'Should do nothing when state matches');
    }

    // Test 2: Temperature drops below min -> Switch to KT
    {
        const input = { ...baseInput, indoorTemp: 19 };
        const result = determineControlAction(input);
        assert(result.action === 'SWITCH_BUTTON', 'Should switch button when temp drops');
        assert(result.targetButton === EtaButtons.KT, 'Should target KT');
        assert(result.newState.wasBelow === true, 'Should update state wasBelow');
    }

    // Test 3: Manual Override Detection
    {
        // User pressed KT, but system expects AA (temp is fine)
        const input = { ...baseInput, currentActiveButton: EtaButtons.KT };
        const result = determineControlAction(input);
        assert(result.action === 'ENTER_OVERRIDE', 'Should enter override mode on mismatch');
        assert(result.newState.manualOverride === true, 'Should set manualOverride flag');
    }

    // Test 4: Respect Manual Override
    {
        // System expects KT (temp low), but user set AA manually previously
        const stateInOverride: ControlState = {
            ...baseState,
            manualOverride: true,
            manualOverrideTime: 1000000
        };
        const input = {
            ...baseInput,
            indoorTemp: 19, // Should be KT normally
            currentActiveButton: EtaButtons.AA, // User wants AA
            lastTempState: stateInOverride,
            currentTime: 1000100 // Just started override
        };
        const result = determineControlAction(input);
        assert(result.action === 'NONE', 'Should respect manual override');
    }

    // Test 5: Override Expiration
    {
        const stateInOverride: ControlState = {
            ...baseState,
            manualOverride: true,
            manualOverrideTime: 1000000
        };
        const input = {
            ...baseInput,
            indoorTemp: 19, // Should be KT
            currentActiveButton: EtaButtons.AA,
            lastTempState: stateInOverride,
            currentTime: 1000000 + 3600000 + 1 // Expired
        };
        const result = determineControlAction(input);
        assert(result.action === 'SWITCH_BUTTON', 'Should switch after override expires');
        assert(result.targetButton === EtaButtons.KT, 'Should target KT');
        assert(result.newState.manualOverride === false, 'Should clear manualOverride flag');
    }

    // Test 6: Slider Negative -> Switch to GT
    {
        const input = { ...baseInput, sliderPos: -1 };
        const result = determineControlAction(input);
        assert(result.action === 'SWITCH_BUTTON', 'Should switch button when slider is negative');
        assert(result.targetButton === EtaButtons.GT, 'Should target GT (Gehen) when slider < 0');
        assert(result.newState.wasSliderNegative === true, 'Should update state wasSliderNegative');
    }

    console.log('All tests passed!');
}

runTests();
