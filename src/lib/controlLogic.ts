import { EtaButtons } from '@/reader/functions/types-constants/EtaConstants';

export interface ControlState {
    wasBelow: boolean;
    wasSliderNegative: boolean;
    manualOverride: boolean;
    manualOverrideTime: number | null;
}

export interface ControlInput {
    indoorTemp: number;
    minTemp: number;
    sliderPos: number;
    currentActiveButton: EtaButtons;
    lastTempState: ControlState;
    manualOverrideDurationMs: number;
    currentTime: number;
}

export interface ControlResult {
    action: 'NONE' | 'ENTER_OVERRIDE' | 'SWITCH_BUTTON';
    targetButton: EtaButtons | null;
    newState: ControlState;
    logs: string[];
}

export function determineControlAction(input: ControlInput): ControlResult {
    const {
        indoorTemp,
        minTemp,
        sliderPos,
        currentActiveButton,
        lastTempState,
        manualOverrideDurationMs,
        currentTime
    } = input;

    const logs: string[] = [];
    const newState = { ...lastTempState };

    const HYSTERESIS = 0.2;
    let isBelow = false;

    if (lastTempState.wasBelow) {
        // We were heating, so we keep heating until we are safely above minTemp + hysteresis
        isBelow = indoorTemp <= (minTemp + HYSTERESIS);
    } else {
        // We were NOT heating, so we only start if we drop below minTemp
        isBelow = indoorTemp < minTemp;
    }
    const isSliderNegative = sliderPos < 0;

    // Check if manual override is still active
    let isManualOverride = false;
    if (newState.manualOverride && newState.manualOverrideTime) {
        const timeSinceOverride = currentTime - newState.manualOverrideTime;
        if (timeSinceOverride > manualOverrideDurationMs) {
            logs.push('Manual override timeout expired');
            newState.manualOverride = false;
            newState.manualOverrideTime = null;
            isManualOverride = false;
        } else {
            isManualOverride = true;
            logs.push(`Manual override still active (${Math.round(timeSinceOverride / 1000)}s / ${Math.round(manualOverrideDurationMs / 1000)}s)`);
        }
    }

    // Determine expected button
    let expectedButton: EtaButtons;
    if (isSliderNegative) {
        expectedButton = EtaButtons.GT;
    } else if (isBelow) {
        expectedButton = EtaButtons.KT;
    } else {
        expectedButton = EtaButtons.AA;
    }

    const stateChanged = (lastTempState.wasBelow !== isBelow) || (lastTempState.wasSliderNegative !== isSliderNegative);
    const buttonMismatch = currentActiveButton !== expectedButton;

    logs.push(`Decision: expected=${expectedButton}, current=${currentActiveButton}`);
    logs.push(`Checks: stateChanged=${stateChanged}, buttonMismatch=${buttonMismatch}, isManualOverride=${isManualOverride}`);

    // CRITICAL FIX: If button mismatch detected and NOT in override, assume user pressed button -> ENTER override
    if (buttonMismatch && !isManualOverride && !stateChanged) {
        logs.push(`⚠️ Manual override detected! User changed button to ${currentActiveButton} (expected ${expectedButton}). Entering override mode.`);
        newState.manualOverride = true;
        newState.manualOverrideTime = currentTime;
        return { action: 'ENTER_OVERRIDE', targetButton: null, newState, logs };
    }

    if (!isManualOverride && (stateChanged || buttonMismatch)) {
        if (stateChanged) {
            newState.wasBelow = isBelow;
            newState.wasSliderNegative = isSliderNegative;
        }
        return { action: 'SWITCH_BUTTON', targetButton: expectedButton, newState, logs };
    }

    return { action: 'NONE', targetButton: null, newState, logs };
}
