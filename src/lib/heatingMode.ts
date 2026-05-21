import { EtaApi } from '@/reader/functions/EtaApi';
import { ETA_MODE_BUTTONS, EtaButtons, EtaModeButton, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants, Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export type HeatingButtonIds = Record<EtaModeButton, string>;
export type HeatingButtonFlags = Partial<Record<EtaModeButton, boolean>>;

const BUTTON_CONSTANTS: Record<EtaModeButton, EtaConstants> = {
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
  targetButton: EtaModeButton;
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

  log?.(`Turning off non-target mode buttons before activating ${targetButton}`);
  for (const button of ETA_MODE_BUTTONS) {
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
  for (const button of ETA_MODE_BUTTONS) {
    if (button === targetButton) {
      continue;
    }
    await etaApi.setUserVar(buttonIds[button], EtaPos.AUS, '0', '0');
    await wait();
  }

  return buttonIds;
}
