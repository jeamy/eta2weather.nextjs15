import { EtaData } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { parseNum } from '@/utils/numberParser';

export default function EtaControlStatus({
  data, isStale, controlDataReady,
}: {
  data: EtaData;
  isStale: boolean;
  controlDataReady: boolean;
}) {
  if (controlDataReady || Object.keys(data).length === 0) return null;

  const flow = Object.values(data).find(item => item.short === EtaConstants.VORLAUFTEMP);
  const flowValue = parseNum(flow?.strValue);
  const reason = isStale
    ? 'ETA-Abfrage veraltet oder unvollständig.'
    : flowValue === null || !Number.isFinite(flowValue)
      ? 'Vorlauftemperatur nicht verfügbar.'
      : 'ETA-Regelungsdaten nicht verfügbar oder ungültig.';

  return (
    <div className="alert alert--warning mb-3" role="status">
      <span><strong>Regelung pausiert.</strong> {reason}</span>
    </div>
  );
}
