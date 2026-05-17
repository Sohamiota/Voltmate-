/** Stable CRM enum IDs — keep in sync with backend `DEFERRAL_BUCKETS` / `CONTACT_DISPOSITIONS`. */

export const CRM_DEFERRAL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Not specified —' },
  { value: 'within_1_month', label: 'Within 1 month' },
  { value: 'within_2_months', label: 'Within 2 months' },
  { value: 'within_3_months', label: 'Within 3 months' },
  { value: 'beyond_3_months', label: 'Beyond 3 months' },
  { value: 'unknown', label: 'Unknown / refused to say' },
];

export const CRM_CONTACT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Not specified —' },
  { value: 'busy_will_call_back', label: 'Busy — customer will call us back' },
  { value: 'requested_callback_later', label: 'Busy — asked us to call later' },
  { value: 'needs_time_to_decide', label: 'Needs time to decide' },
  { value: 'travel_or_offline', label: 'Travel / offline / unreachable briefly' },
  { value: 'talk_to_family_first', label: 'Must discuss with family / partner' },
  { value: 'comparing_options', label: 'Comparing options / shopping around' },
];

/** `<input type="datetime-local">` value from ISO string (browser-local components). */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Strip empty-string pseudo-nulls before POST JSON */
export function crmPayloadFromForm(f: {
  deferral_bucket: string;
  deferral_notes: string;
  follow_up_after_date: string;
  earliest_purchase_intent_date: string;
  contact_disposition: string;
  callback_requested_at: string;
  customer_promised_callback: boolean;
}) {
  let callbackIso: string | null = null;
  const cbRaw = f.callback_requested_at.trim();
  if (cbRaw) {
    const d = new Date(cbRaw);
    callbackIso = isNaN(d.getTime()) ? null : d.toISOString();
  }
  return {
    deferral_bucket: f.deferral_bucket.trim() || null,
    deferral_notes: f.deferral_notes.trim() || null,
    follow_up_after_date: f.follow_up_after_date.trim() || null,
    earliest_purchase_intent_date: f.earliest_purchase_intent_date.trim() || null,
    contact_disposition: f.contact_disposition.trim() || null,
    callback_requested_at: callbackIso,
    customer_promised_callback: f.customer_promised_callback,
  };
}

export function labelForDeferral(id: string | null | undefined): string {
  if (id == null || id === '') return '—';
  return CRM_DEFERRAL_OPTIONS.find(o => o.value === id)?.label ?? id;
}

export function labelForContact(id: string | null | undefined): string {
  if (id == null || id === '') return '—';
  return CRM_CONTACT_OPTIONS.find(o => o.value === id)?.label ?? id;
}
