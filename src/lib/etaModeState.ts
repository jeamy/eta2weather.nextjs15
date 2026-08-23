import {
  ETA_MODE_BUTTONS,
  EtaButtons,
  EtaData,
  EtaModeButton,
  EtaPos,
  EtaText,
} from '@/reader/functions/types-constants/EtaConstants';

export interface EtaModeState {
  activeButton: EtaModeButton | null;
  activeButtons: EtaModeButton[];
  isValid: boolean;
}

export function getEtaModeState(etaData: EtaData): EtaModeState {
  const activeButtons: EtaModeButton[] = [];

  for (const item of Object.values(etaData || {})) {
    if (
      ETA_MODE_BUTTONS.includes(item.short as EtaModeButton) &&
      item.value === EtaPos.EIN &&
      !activeButtons.includes(item.short as EtaModeButton)
    ) {
      activeButtons.push(item.short as EtaModeButton);
    }
  }

  const activeButton =
    activeButtons.find(button => button !== EtaButtons.AA) ??
    activeButtons[0] ??
    null;

  return {
    activeButton,
    activeButtons,
    isValid: activeButtons.length === 1,
  };
}

export function normalizeEtaButtonState(etaData: EtaData): EtaData {
  const normalized = { ...etaData };
  const { activeButton } = getEtaModeState(normalized);

  // Do not invent an active mode. An all-off state is important diagnostic
  // information and lets the controller repair the physical device state.
  if (!activeButton) {
    return normalized;
  }

  for (const [uri, item] of Object.entries(normalized)) {
    if (!ETA_MODE_BUTTONS.includes(item.short as EtaModeButton)) {
      continue;
    }
    const isActive = item.short === activeButton;
    normalized[uri] = {
      ...item,
      value: isActive ? EtaPos.EIN : EtaPos.AUS,
      strValue: isActive ? EtaText.EIN : EtaText.AUS,
    };
  }

  return normalized;
}
