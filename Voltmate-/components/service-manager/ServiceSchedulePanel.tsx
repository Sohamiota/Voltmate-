'use client';

import { useState } from 'react';
import { SERVICE_SCHEDULES, formatMilestone } from '@/lib/serviceSchedule';
import { SM_CARD } from '@/lib/serviceManagerUi';

export default function ServiceSchedulePanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className={`mb-6 ${SM_CARD} overflow-hidden`}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div>
          <div className="text-sm font-semibold text-zinc-100">Euler service schedule</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            KM or months — whichever comes first · Free services allow +500 km grace
          </div>
        </div>
        <span className="text-zinc-500 text-xs">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px] text-[12px]">
            <thead>
              <tr className="text-zinc-500 uppercase tracking-wide text-[10px]">
                <th className="text-left py-2 pr-4 font-bold">Line</th>
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i} className="text-center py-2 px-2 font-bold whitespace-nowrap">
                    {i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}
                  </th>
                ))}
                <th className="text-center py-2 pl-2 font-bold">Next</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(SERVICE_SCHEDULES).map(line => (
                <tr key={line.label} className="border-t border-zinc-800">
                  <td className="py-2.5 pr-4 font-semibold text-zinc-200 whitespace-nowrap">{line.label}</td>
                  {Array.from({ length: 8 }, (_, i) => {
                    const m = line.milestones.find(x => x.serviceNo === i + 1);
                    return (
                      <td
                        key={i}
                        className={`py-2.5 px-2 text-center align-top ${m?.isFree ? 'bg-violet-500/[0.08] text-violet-200' : 'text-zinc-500'}`}
                      >
                        {m ? formatMilestone(m) : '—'}
                      </td>
                    );
                  })}
                  <td className="py-2.5 pl-2 text-center text-zinc-500 whitespace-nowrap">{line.recurring.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-zinc-600 mt-3">
            Vehicle type on each record selects the line (Storm, Turbo, Neo, HiLoad/HiCity). Due dates use purchase date for free services; later services follow the &ldquo;Next&rdquo; interval from completion.
          </p>
        </div>
      )}
    </div>
  );
}
