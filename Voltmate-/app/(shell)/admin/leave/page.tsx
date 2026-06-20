'use client';

import { useCallback, useEffect, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

type LeaveReq = {
  id: number;
  user_id: number;
  leave_type: 'CL' | 'SL';
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  admin_note: string | null;
  employee_name: string | null;
  employee_email: string | null;
  approver_name: string | null;
  created_at: string;
  requires_proof?: boolean;
  proof_path?: string | null;
  proof_filename?: string | null;
};

function fmtDate(d: string): string {
  const plain = d.slice(0, 10);
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const leaveTypeBadgeClass: Record<string, string> = {
  CL: 'bg-blue-500/15 text-blue-300',
  SL: 'bg-purple-500/15 text-purple-300',
};

const statusBadgeClass: Record<string, string> = {
  pending:  'bg-amber-400/15 text-amber-300',
  approved: 'bg-green-500/15 text-green-300',
  rejected: 'bg-red-500/15  text-red-300',
};

export default function AdminLeavePage() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [rows, setRows] = useState<LeaveReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = tab === 'pending' ? '?status=pending' : '';
      const res = await fetch(`${API}/api/v1/leave${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setRows(j.requests || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: number, approve: boolean, row: LeaveReq) {
    if (!token) return;
    if (approve && row.requires_proof && !row.proof_path) {
      alert('Medical proof not uploaded yet. Employee must upload a document before you can approve.');
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`${API}/api/v1/leave/admin/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approve, note: notes[id] || '' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message || j.error || 'Action failed');
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function viewProof(id: number) {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/leave/${id}/proof`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Could not load document');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  const tabBase = 'px-[14px] py-2 rounded-lg border text-xs font-semibold cursor-pointer';
  const tabInactive = 'bg-zinc-900 border-[#333] text-zinc-400';
  const tabActive = 'bg-[rgba(0,217,255,0.12)] border-[rgba(0,217,255,0.35)] text-cyan-400';
  const badgeBase = 'inline-block px-2 py-[2px] rounded-full text-[10px] font-bold uppercase tracking-[0.4px] mr-1.5';
  const btnBase = 'px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer border disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="bg-zinc-950 min-h-screen">
      <div className="max-w-[960px] mx-auto px-5 py-7 font-sans text-zinc-200">

        <div className="mb-5">
          <div className="text-[22px] font-bold text-white">Leave approvals</div>
          <div className="text-[13px] text-zinc-400 mt-1">
            CL needs 2-day advance notice. SL over 2 days requires medical proof before approval.
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            className={`${tabBase} ${tab === 'pending' ? tabActive : tabInactive}`}
            onClick={() => setTab('pending')}
          >
            Pending
          </button>
          <button
            type="button"
            className={`${tabBase} ${tab === 'all' ? tabActive : tabInactive}`}
            onClick={() => setTab('all')}
          >
            All requests
          </button>
          <button
            type="button"
            className={`${tabBase} ${tabInactive} disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        <div className="bg-[#111] border border-zinc-800 rounded-xl overflow-hidden mb-3">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-[13px]">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-[13px]">
              No leave requests{tab === 'pending' ? ' pending approval' : ''}.
            </div>
          ) : rows.map(r => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_auto] gap-3 px-4 py-[14px] border-b border-[#1e1e1e] items-center last:border-b-0"
            >
              <div>
                <div className="text-sm font-semibold text-white">
                  <span className={`${badgeBase} ${leaveTypeBadgeClass[r.leave_type] ?? ''}`}>
                    {r.leave_type}
                  </span>
                  <span className={`${badgeBase} ${statusBadgeClass[r.status] ?? ''}`}>
                    {r.status}
                  </span>
                  {r.employee_name || r.employee_email || `User #${r.user_id}`}
                </div>

                <div className="text-xs text-zinc-400 mt-1 leading-[1.45]">
                  {fmtDate(r.start_date)} → {fmtDate(r.end_date)} · <strong>{r.days}</strong> working day(s)
                  {r.reason ? ` · ${r.reason}` : ''}
                </div>

                {r.admin_note && (
                  <div className="text-xs text-zinc-400 mt-1.5 leading-[1.45]">
                    Admin note: {r.admin_note}
                  </div>
                )}

                {r.requires_proof && (
                  <div className={`text-[11px] mt-1.5 ${r.proof_path ? 'text-green-300' : 'text-amber-300'}`}>
                    {r.proof_path
                      ? <>Medical proof uploaded{r.proof_filename ? `: ${r.proof_filename}` : ''} · </>
                      : 'Medical proof required — waiting for employee upload · '}
                    {r.proof_path && (
                      <button
                        type="button"
                        className="bg-transparent border-none text-blue-300 text-[11px] cursor-pointer underline p-0"
                        onClick={() => void viewProof(r.id)}
                      >
                        View document
                      </button>
                    )}
                  </div>
                )}

                {r.status === 'pending' && (
                  <input
                    className="w-full mt-2 bg-zinc-900 border border-[#333] rounded-lg p-2 text-zinc-200 text-xs"
                    placeholder="Optional note for employee"
                    value={notes[r.id] || ''}
                    onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                  />
                )}
              </div>

              {r.status === 'pending' && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className={`${btnBase} bg-green-500/10 border-green-500/35 text-green-500`}
                    disabled={busyId === r.id || !!(r.requires_proof && !r.proof_path)}
                    onClick={() => void decide(r.id, true, r)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`${btnBase} bg-red-500/10 border-red-500/35 text-red-500`}
                    disabled={busyId === r.id}
                    onClick={() => void decide(r.id, false, r)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
