import {
  ETA_MODE_BUTTONS,
  EtaButtons,
  EtaData,
  EtaModeButton,
  EtaPos,
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
