'use client';

import { SM_CARD, SM_INPUT } from '@/lib/serviceManagerUi';

interface FormState {
  actual_km: string;
  completion_date: string;
  cost: string;
  remarks?: string;
}

interface Props {
  serviceNo: number;
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  busy?: boolean;
  showRemarks?: boolean;
}

export default function MarkServiceDoneSheet({
  serviceNo,
  form,
  onChange,
  onClose,
  onSubmit,
  busy,
  showRemarks,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        className={`${SM_CARD} p-6 min-w-[300px] max-w-[90vw]`}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 font-semibold text-white">Mark Service #{serviceNo} done</div>
        <div className="space-y-3">
          <input
            required
            type="number"
            placeholder="Actual KM"
            value={form.actual_km}
            onChange={e => onChange({ actual_km: e.target.value })}
            className={`${SM_INPUT} w-full`}
          />
          <input
            required
            type="date"
            value={form.completion_date}
            onChange={e => onChange({ completion_date: e.target.value })}
            className={`${SM_INPUT} w-full`}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Cost (optional)"
            value={form.cost}
            onChange={e => onChange({ cost: e.target.value })}
            className={`${SM_INPUT} w-full`}
          />
          {showRemarks && (
            <textarea
              placeholder="Remarks (optional)"
              value={form.remarks ?? ''}
              onChange={e => onChange({ remarks: e.target.value })}
              className={`${SM_INPUT} w-full min-h-[72px] resize-y`}
            />
          )}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 border border-zinc-800 rounded-lg text-zinc-400">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-xs px-3 py-1.5 bg-cyan-400 text-zinc-950 rounded-lg font-semibold disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
