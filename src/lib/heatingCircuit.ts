import { EtaApi } from '@/reader/functions/EtaApi';
import { parseXML } from '@/reader/functions/EtaData';
import { EtaPos, ParsedXmlData, isCircuitPosition } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants, Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import { normalizeEtaVariableId } from '@/utils/etaIdentifiers';

type CircuitApi = Pick<EtaApi, 'getUserVar' | 'setUserVar'>;
type CircuitOutcome = {
  status: 'applied' | 'changed' | 'uncertain';
  data?: ParsedXmlData;
};

const shared = globalThis as typeof globalThis & {
  __ETA2WEATHER_CIRCUIT_QUEUE__?: Promise<void>;
};

export async function setHeatingCircuit(options: {
  etaApi: CircuitApi;
  names2id: Names2Id;
  expected: EtaPos;
  target: EtaPos;
  onRead?: (id: string, data: ParsedXmlData) => void;
}): Promise<CircuitOutcome> {
  const operation = (shared.__ETA2WEATHER_CIRCUIT_QUEUE__ ?? Promise.resolve())
    .then(() => applyHeatingCircuit(options));
  shared.__ETA2WEATHER_CIRCUIT_QUEUE__ = operation.then(() => undefined, () => undefined);
  return operation;
}

async function applyHeatingCircuit({
  etaApi, names2id, expected, target, onRead,
}: Parameters<typeof setHeatingCircuit>[0]): Promise<CircuitOutcome> {
  const id = names2id[EtaConstants.EIN_AUS_TASTE]?.id;
  const normalizedId = id && normalizeEtaVariableId(id);
  if (!normalizedId || !isCircuitPosition(expected) || !isCircuitPosition(target) || expected === target) {
    throw new Error('Ungültige Heizkreis-Anfrage oder ETA-Variable');
  }

  const read = async (): Promise<ParsedXmlData> => {
    const response = await etaApi.getUserVar(id);
    if (response.error || !response.result) throw new Error('ETA-Status konnte nicht gelesen werden');
    const data = parseXML(response.result, EtaConstants.EIN_AUS_TASTE, names2id);
    if (!isCircuitPosition(data.value) || normalizeEtaVariableId(data.id) !== normalizedId) {
      throw new Error('ETA liefert einen ungültigen Heizkreis-Status');
    }
    onRead?.(id, data);
    return data;
  };

  const before = await read();
  if (before.value !== expected) return { status: 'changed', data: before };

  try {
    const response = await etaApi.setUserVar(id, target, '0', '0');
    if (response.error || !response.result) return { status: 'uncertain' };
    const after = await read();
    return { status: after.value === target ? 'applied' : 'uncertain', data: after };
  } catch {
    // A timeout or failed readback does not prove the write had no effect.
    return { status: 'uncertain' };
  }
}
