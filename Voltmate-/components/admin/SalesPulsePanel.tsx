'use client';

import { useCallback, useState } from 'react';
import { API_BASE, getStoredToken } from '@/src/api/client';

interface PreviewData {
  bot_name: string;
  week: string;
  summary: { total_targets: number; total_updated: number; total_pending: number };
  message: string;
}

export default function SalesPulsePanel() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [simText, setSimText] = useState('');
  const [simReply, setSimReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const headers = useCallback((): Record<string, string> => {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  async function loadPreview() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/digest/preview`, { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      setPreview(await res.json());
      setOpen(true);
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    setBusy(true);
    setStatus(null);
    try {
      const qs = sendTo.trim() ? `?to=${encodeURIComponent(sendTo.trim())}` : '';
      const res = await fetch(`${API_BASE}/whatsapp/digest/send${qs}`, {
        method: 'POST',
        headers: headers(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Send failed');
      setStatus(`Sent to ${j.sent} recipient(s)${j.failed ? `, ${j.failed} failed` : ''}`);
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    if (!simText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/simulate?text=${encodeURIComponent(simText.trim())}`, {
        headers: headers(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setSimReply(j.reply || '');
    } catch (e: unknown) {
      setSimReply(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 bg-zinc-900 border border-[#232323] rounded-[10px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-[14px] py-3 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold text-emerald-400">SalesPulse WhatsApp Bot</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Daily target digest · reply by salesperson name · supports WhatsApp groups (Meta Cloud API)
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={loadPreview}
            className="bg-transparent border border-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg text-[11px] font-medium hover:border-emerald-500/40"
          >
            Preview digest
          </button>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-[11px] font-medium"
          >
            {open ? 'Hide' : 'Configure'}
          </button>
        </div>
      </div>

      {status && (
        <div className="px-[14px] pb-3 text-[11px] text-cyan-400">{status}</div>
      )}

      {open && (
        <div className="border-t border-[#232323] px-[14px] py-4 space-y-4">
          {preview && (
            <div>
              <div className="text-[11px] text-zinc-500 mb-2">
                {preview.bot_name} · Week {preview.week} · {preview.summary.total_targets} targets · {preview.summary.total_pending} pending
              </div>
              <pre className="text-[11px] text-zinc-300 whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-[220px] overflow-y-auto font-sans">
                {preview.message}
              </pre>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-[10px] uppercase text-zinc-500 font-bold">Send to (optional override)</label>
              <input
                value={sendTo}
                onChange={e => setSendTo(e.target.value)}
                placeholder="+91… or group:YOUR_GROUP_ID"
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-[12px]"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={sendNow}
              className="px-4 py-2 bg-emerald-500 text-zinc-950 rounded-lg text-[12px] font-semibold"
            >
              Send via WhatsApp
            </button>
          </div>

          <div>
            <label className="text-[10px] uppercase text-zinc-500 font-bold">Test bot reply (type a salesperson name)</label>
            <div className="flex gap-2 mt-1">
              <input
                value={simText}
                onChange={e => setSimText(e.target.value)}
                placeholder="e.g. Rajesh or help"
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-[12px]"
                onKeyDown={e => e.key === 'Enter' && simulate()}
              />
              <button type="button" disabled={busy} onClick={simulate} className="px-3 py-2 border border-zinc-700 rounded-lg text-[12px]">
                Test
              </button>
            </div>
            {simReply && (
              <pre className="mt-2 text-[11px] text-zinc-300 whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-sans">
                {simReply}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
