import type { Urgency } from '@/lib/serviceManagerApi';

export const SM_PAGE =
  'min-h-screen bg-zinc-950 text-zinc-200 font-sans p-[clamp(14px,4vw,28px)]';

export const SM_CARD = 'bg-zinc-900 border border-zinc-800 rounded-xl';
export const SM_INPUT =
  'bg-zinc-900 border border-zinc-800 rounded-lg px-[14px] py-2 text-zinc-200 text-[13px] outline-none focus:border-cyan-400';
export const SM_BTN_GHOST =
  'bg-transparent text-zinc-400 border border-zinc-800 px-[14px] py-[7px] rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-150 hover:border-[#555] hover:text-zinc-200';
export const SM_BTN_PRIMARY =
  'bg-cyan-400 text-zinc-950 border border-cyan-400 px-[14px] py-[7px] rounded-lg text-[12px] font-semibold cursor-pointer transition-all hover:bg-[#00b8d9]';
export const SM_BTN_SECONDARY =
  'bg-transparent text-cyan-400 border border-cyan-400/40 px-[14px] py-[7px] rounded-lg text-[12px] font-semibold cursor-pointer transition-all hover:border-cyan-400';

export function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || '?').toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function customerKey(name: string): string {
  return encodeURIComponent(name.trim() || 'Unassigned');
}

export function decodeCustomerKey(key: string): string {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function urgencyBadgeCls(u: Urgency | string): string {
  if (u === 'overdue') return 'bg-rose-500/15 text-rose-400 border-rose-500/25';
  if (u === 'due_soon') return 'bg-amber-400/12 text-amber-400 border-amber-400/30';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
}

export function urgencyRowBg(u: Urgency | string): string {
  if (u === 'overdue') return 'bg-rose-500/[0.06]';
  if (u === 'due_soon') return 'bg-amber-400/[0.05]';
  return '';
}

export function urgencyLabel(u: Urgency | string): string {
  if (u === 'overdue') return 'Overdue';
  if (u === 'due_soon') return 'Due soon';
  return 'OK';
}
