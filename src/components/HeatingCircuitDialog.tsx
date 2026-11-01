'use client';

import { useEffect, useRef } from 'react';
import { EtaPos } from '@/reader/functions/types-constants/EtaConstants';

export default function HeatingCircuitDialog({
  target, stale, busy, onCancel, onConfirm,
}: {
  target: EtaPos;
  stale: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="etaConfirmDialog"
      aria-labelledby="eta-circuit-dialog-title"
      aria-describedby="eta-circuit-dialog-description"
      onCancel={event => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="eta-circuit-dialog-title">
        Heizkreis {target === EtaPos.AUS ? 'ausschalten' : 'einschalten'}?
      </h2>
      <p id="eta-circuit-dialog-description">
        {target === EtaPos.AUS
          ? 'Der Heizkreis wird ausgeschaltet. Die Mindesttemperaturregelung der App kann dann nicht heizen.'
          : 'Der Heizkreis wird eingeschaltet.'}
        {stale && ' Die ETA-Daten sind nicht vollständig aktuell; der Zustand wird vor dem Schalten überprüft.'}
      </p>
      <div className="etaConfirmDialog__actions">
        <button type="button" className="btn btn--ghost" autoFocus disabled={busy}
          onClick={onCancel}>Nein</button>
        <button type="button" className={`btn ${target === EtaPos.AUS ? 'btn--danger' : 'btn--primary'}`}
          disabled={busy} onClick={onConfirm}>
          {busy ? 'Wird geschaltet…' : 'Ja'}
        </button>
      </div>
    </dialog>
  );
}
