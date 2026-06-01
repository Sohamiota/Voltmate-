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

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  .lv-root{max-width:960px;margin:0 auto;padding:28px 20px;font-family:'Inter',system-ui,sans-serif;color:#e5e5e5;}
  .lv-hdr{margin-bottom:20px;}
  .lv-title{font-size:22px;font-weight:700;color:#fff;}
  .lv-sub{font-size:13px;color:#9ca3af;margin-top:4px;}
  .lv-tabs{display:flex;gap:8px;margin-bottom:16px;}
  .lv-tab{padding:8px 14px;border-radius:8px;border:1px solid #333;background:#141414;color:#9ca3af;font-size:12px;font-weight:600;cursor:pointer;}
  .lv-tab.active{background:rgba(0,217,255,.12);border-color:rgba(0,217,255,.35);color:#00d9ff;}
  .lv-card{background:#111;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:12px;}
  .lv-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:14px 16px;border-bottom:1px solid #1e1e1e;align-items:center;}
  .lv-row:last-child{border-bottom:none;}
  .lv-name{font-size:14px;font-weight:600;color:#fff;}
  .lv-meta{font-size:12px;color:#9ca3af;margin-top:4px;line-height:1.45;}
  .lv-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-right:6px;}
  .lv-cl{background:rgba(59,130,246,.15);color:#93c5fd;}
  .lv-sl{background:rgba(168,85,247,.15);color:#d8b4fe;}
  .lv-pending{background:rgba(251,191,36,.15);color:#fcd34d;}
  .lv-approved{background:rgba(34,197,94,.15);color:#86efac;}
  .lv-rejected{background:rgba(239,68,68,.15);color:#fca5a5;}
  .lv-actions{display:flex;gap:8px;flex-wrap:wrap;}
  .lv-btn{padding:7px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid;}
  .lv-btn-ok{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.35);color:#22c55e;}
  .lv-btn-no{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.35);color:#ef4444;}
  .lv-btn:disabled{opacity:.45;cursor:not-allowed;}
  .lv-empty{padding:32px;text-align:center;color:#6b7280;font-size:13px;}
  .lv-note{width:100%;margin-top:8px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;color:#e5e5e5;font-size:12px;}
  .lv-proof-warn{color:#fcd34d;font-size:11px;margin-top:6px;}
  .lv-proof-ok{color:#86efac;font-size:11px;margin-top:6px;}
  .lv-link{background:transparent;border:none;color:#93c5fd;font-size:11px;cursor:pointer;text-decoration:underline;padding:0;}
`;

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

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div className="lv-root">
        <div className="lv-hdr">
          <div className="lv-title">Leave approvals</div>
          <div className="lv-sub">CL needs 2-day advance notice. SL over 2 days requires medical proof before approval.</div>
        </div>

        <div className="lv-tabs">
          <button type="button" className={`lv-tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
            Pending
          </button>
          <button type="button" className={`lv-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>
            All requests
          </button>
          <button type="button" className="lv-tab" onClick={() => void load()} disabled={loading}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        <div className="lv-card">
          {loading ? (
            <div className="lv-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="lv-empty">No leave requests{tab === 'pending' ? ' pending approval' : ''}.</div>
          ) : rows.map(r => (
            <div key={r.id} className="lv-row">
              <div>
                <div className="lv-name">
                  <span className={`lv-badge ${r.leave_type === 'CL' ? 'lv-cl' : 'lv-sl'}`}>{r.leave_type}</span>
                  <span className={`lv-badge lv-${r.status}`}>{r.status}</span>
                  {r.employee_name || r.employee_email || `User #${r.user_id}`}
                </div>
                <div className="lv-meta">
                  {fmtDate(r.start_date)} → {fmtDate(r.end_date)} · <strong>{r.days}</strong> working day(s)
                  {r.reason ? ` · ${r.reason}` : ''}
                </div>
                {r.admin_note && (
                  <div className="lv-meta" style={{ marginTop: 6 }}>Admin note: {r.admin_note}</div>
                )}
                {r.requires_proof && (
                  <div className={r.proof_path ? 'lv-proof-ok' : 'lv-proof-warn'}>
                    {r.proof_path
                      ? <>Medical proof uploaded{r.proof_filename ? `: ${r.proof_filename}` : ''} · </>
                      : 'Medical proof required — waiting for employee upload · '}
                    {r.proof_path && (
                      <button type="button" className="lv-link" onClick={() => void viewProof(r.id)}>
                        View document
                      </button>
                    )}
                  </div>
                )}
                {r.status === 'pending' && (
                  <input
                    className="lv-note"
                    placeholder="Optional note for employee"
                    value={notes[r.id] || ''}
                    onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                  />
                )}
              </div>
              {r.status === 'pending' && (
                <div className="lv-actions">
                  <button
                    type="button"
                    className="lv-btn lv-btn-ok"
                    disabled={busyId === r.id || !!(r.requires_proof && !r.proof_path)}
                    onClick={() => void decide(r.id, true, r)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="lv-btn lv-btn-no"
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
