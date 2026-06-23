'use client';

import React, { useState } from 'react';
import { PdiItem, Vehicle, fmtDate } from '@/lib/serviceManagerApi';

const DEFAULT_ITEMS: PdiItem[] = [
  { id: 'battery', label: 'Battery & BMS check', status: 'pending' },
  { id: 'charger', label: 'Charger & cable', status: 'pending' },
  { id: 'documents', label: 'Documents & RC', status: 'pending' },
  { id: 'cosmetic', label: 'Cosmetic inspection', status: 'pending' },
];

interface Props {
  vehicle: Vehicle;
  canWrite?: boolean;
  busy?: boolean;
  onSave: (status: string, checklist: PdiItem[]) => void;
}

export default function PdiChecklist({ vehicle, canWrite = true, busy, onSave }: Props) {
  const initial = (vehicle.pdi_checklist?.length ? vehicle.pdi_checklist : DEFAULT_ITEMS) as PdiItem[];
  const [checklist, setChecklist] = useState<PdiItem[]>(initial);
  const [status, setStatus] = useState(vehicle.pdi_status || 'pending');

  function updateItem(id: string, itemStatus: PdiItem['status']) {
    setChecklist(prev => prev.map(item => (item.id === id ? { ...item, status: itemStatus } : item)));
    if (status === 'pending') setStatus('in_progress');
  }

  const allDone = checklist.every(i => i.status === 'pass' || i.status === 'na');
  const hasFail = checklist.some(i => i.status === 'fail');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-[#545968] font-bold">PDI status</div>
          <div className="text-sm font-semibold capitalize mt-0.5">{status.replace('_', ' ')}</div>
          {vehicle.pdi_due_date && (
            <div className="text-xs text-[#8e97ad]">Due {fmtDate(vehicle.pdi_due_date)}</div>
          )}
        </div>
        {vehicle.pdi_completed_at && (
          <div className="text-xs text-[#10b981]">Completed {fmtDate(vehicle.pdi_completed_at.slice(0, 10))}</div>
        )}
      </div>

      <div className="space-y-2">
        {checklist.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-2 border border-[#1e2236] rounded-lg px-3 py-2">
            <span className="text-sm">{item.label}</span>
            {canWrite ? (
              <select
                value={item.status}
                onChange={e => updateItem(item.id, e.target.value as PdiItem['status'])}
                className="text-xs bg-[#0a0c12] border border-[#1e2236] rounded px-2 py-1"
              >
                <option value="pending">Pending</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="na">N/A</option>
              </select>
            ) : (
              <span className="text-xs capitalize text-[#8e97ad]">{item.status}</span>
            )}
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={busy || !allDone || hasFail}
            onClick={() => onSave('done', checklist)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#10b981]/20 text-[#10b981] disabled:opacity-40"
          >
            Complete PDI
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave('waived', checklist)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1e2236] text-[#8e97ad]"
          >
            Waive
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(status, checklist)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-400"
          >
            Save progress
          </button>
        </div>
      )}
    </div>
  );
}
