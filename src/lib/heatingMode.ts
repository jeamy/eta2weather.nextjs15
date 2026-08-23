import { EtaApi } from '@/reader/functions/EtaApi';
import { ETA_MODE_BUTTONS, EtaButtons, EtaModeButton, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants, Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export type HeatingButtonIds = Record<EtaModeButton, string>;

async function writeHeatingButton(
  etaApi: EtaApi,
  id: string,
  value: EtaPos,
  button: EtaModeButton,
): Promise<void> {
  const response = await etaApi.setUserVar(id, value, '0', '0');
  if (response.error || !response.result) {
    throw new Error(`Failed to set heating button ${button}: ${response.error || 'empty ETA response'}`);
  }
}

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
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<HeatingButtonIds> {
  const {
    targetButton,
    names2id,
    etaApi,
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
    await writeHeatingButton(etaApi, buttonIds[button], EtaPos.AUS, button);
    await wait();
  }

  log?.(`Activating ${targetButton}`);
  await writeHeatingButton(etaApi, buttonIds[targetButton], EtaPos.EIN, targetButton);
  await wait();

  return buttonIds;
}
