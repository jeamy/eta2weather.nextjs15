import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaButtons, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants, Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export type HeatingButtonIds = Record<EtaButtons, string>;
export type HeatingButtonFlags = Partial<Record<EtaButtons, boolean>>;
const MODE_BUTTONS = [EtaButtons.HT, EtaButtons.KT, EtaButtons.AA, EtaButtons.GT, EtaButtons.DT] as const;

const BUTTON_CONSTANTS: Record<EtaButtons, EtaConstants> = {
  [EtaButtons.EAT]: EtaConstants.EIN_AUS_TASTE,
  [EtaButtons.HT]: EtaConstants.HEIZENTASTE,
  [EtaButtons.KT]: EtaConstants.KOMMENTASTE,
  [EtaButtons.AA]: EtaConstants.AUTOTASTE,
  [EtaButtons.GT]: EtaConstants.GEHENTASTE,
  [EtaButtons.DT]: EtaConstants.ABSENKTASTE,
};

export function getHeatingButtonIds(names2id: Names2Id): HeatingButtonIds {
  const entries = Object.entries(BUTTON_CONSTANTS).map(([button, constant]) => {
    const id = names2id[constant]?.id;
    if (!id) {
      throw new Error(`Button ID not found for ${button}`);
    }
    return [button, id] as const;
  });

  return Object.fromEntries(entries) as HeatingButtonIds;
}

export async function setHeatingMode(options: {
  targetButton: EtaButtons;
  names2id: Names2Id;
  etaApi: EtaApi;
  activeFlags?: HeatingButtonFlags;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<HeatingButtonIds> {
  const {
    targetButton,
    names2id,
    etaApi,
    activeFlags = {},
    delayMs = 0,
    sleep = async () => undefined,
    log,
  } = options;
  const buttonIds = getHeatingButtonIds(names2id);
  const wait = async () => {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  };

  if (targetButton !== EtaButtons.EAT && activeFlags[EtaButtons.EAT] !== true) {
    log?.(`Turning on ${EtaButtons.EAT} before activating ${targetButton}`);
    await etaApi.setUserVar(buttonIds[EtaButtons.EAT], EtaPos.EIN, '0', '0');
    await wait();
  }

  const buttonsToSwitch = targetButton === EtaButtons.EAT ? Object.values(EtaButtons) : MODE_BUTTONS;

  log?.(`Turning off non-target mode buttons before activating ${targetButton}`);
  for (const button of buttonsToSwitch) {
    if (button === targetButton) {
      continue;
    }
    if (activeFlags[button] === false) {
      continue;
    }
    await etaApi.setUserVar(buttonIds[button], EtaPos.AUS, '0', '0');
    await wait();
  }

  log?.(`Activating ${targetButton}`);
  await etaApi.setUserVar(buttonIds[targetButton], EtaPos.EIN, '0', '0');
  await wait();

  log?.(`Ensuring only ${targetButton} remains active`);
  for (const button of buttonsToSwitch) {
    if (button === targetButton) {
      continue;
    }
    await etaApi.setUserVar(buttonIds[button], EtaPos.AUS, '0', '0');
    await wait();
  }

  return buttonIds;
}
