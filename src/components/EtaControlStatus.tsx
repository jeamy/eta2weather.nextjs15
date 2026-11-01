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
  if (Object.keys(data).length === 0) return null;

  const flow = Object.values(data).find(item => item.short === EtaConstants.VORLAUFTEMP);
  const flowValue = parseNum(flow?.strValue);
  const flowUnavailable = flowValue === null || !Number.isFinite(flowValue);
  if (controlDataReady && !flowUnavailable) return null;

  return (
    <div className="alert alert--warning mb-3" role="status">
      <span>
        {!controlDataReady && (
          <><strong>Regelung pausiert.</strong> {isStale
            ? 'ETA-Abfrage veraltet oder unvollständig.'
            : 'ETA-Regelungsdaten nicht verfügbar oder ungültig.'} </>
        )}
        {flowUnavailable && 'Vorlauftemperatur nicht verfügbar. Schieber-Dämpfung inaktiv.'}
      </span>
    </div>
  );
}
