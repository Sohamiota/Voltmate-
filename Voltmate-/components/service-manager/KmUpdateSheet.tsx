'use client';

import { SM_CARD, SM_INPUT } from '@/lib/serviceManagerUi';

interface Props {
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
}

export default function KmUpdateSheet({ onClose, value, onChange, onSubmit, busy }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div className={`${SM_CARD} p-6 min-w-[280px]`} onClick={e => e.stopPropagation()}>
        <div className="mb-3 font-semibold text-white">Update current KM</div>
        <input
          type="number"
          min={0}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${SM_INPUT} w-full mb-4 font-mono`}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 border border-zinc-800 rounded-lg text-zinc-400">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSubmit}
            className="text-xs px-3 py-1.5 bg-cyan-400 text-zinc-950 rounded-lg font-semibold disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
