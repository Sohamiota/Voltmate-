/** Plain-text rules for CRM / EMS free-text fields (no emojis / stray symbols). */

export type CrmPlainTextKind = 'name' | 'location' | 'note' | 'identifier' | 'url';

const EMOJI_RE = /\p{Extended_Pictographic}/u;
export const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\uFEFF]/;

/** Dash punctuation (hyphen, en dash, em dash) allowed in business copy. */
const DASHES = '\\p{Pd}';

const STRIP_RE: Record<CrmPlainTextKind, RegExp> = {
  name: new RegExp(`[^\\p{L}\\p{M}\\s.'\\-${DASHES}]`, 'gu'),
  location: new RegExp(`[^\\p{L}\\p{M}\\d\\s.,\\-/${DASHES}()&]`, 'gu'),
  note: new RegExp(`[^\\p{L}\\p{M}\\d\\s.,;:'"!?\\-/${DASHES}()%&+]`, 'gu'),
  identifier: new RegExp(`[^\\p{L}\\p{M}\\d\\s.\\-_/${DASHES}]`, 'gu'),
  url: new RegExp(`[^\\p{L}\\p{M}\\d\\s.\\-_/:${DASHES}@%&?=#]`, 'gu'),
};

export const CRM_TEXT_ERROR =
  'Emojis and special characters are not allowed. Use letters, numbers, and common punctuation only.';

export function sanitizeCrmPlainText(value: string, kind: CrmPlainTextKind = 'note'): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(CONTROL_CHAR_RE, '')
    .replace(STRIP_RE[kind], '');
}

export function crmPlainTextError(
  value: string | null | undefined,
  kind: CrmPlainTextKind = 'note',
  required = false,
): string | null {
  if (value === null || value === undefined || value === '') {
    return required ? 'required' : null;
  }
  if (typeof value !== 'string') return 'must be a string';
  const trimmed = value.trim();
  if (!trimmed) return required ? 'required' : null;
  if (EMOJI_RE.test(trimmed) || CONTROL_CHAR_RE.test(trimmed)) {
    return 'contains emojis or disallowed characters';
  }
  const sanitized = sanitizeCrmPlainText(trimmed, kind);
  if (sanitized !== trimmed) return 'contains emojis or disallowed characters';
  return null;
}

export function crmPlainTextFieldLabel(kind: CrmPlainTextKind): string {
  switch (kind) {
    case 'name': return 'Name';
    case 'location': return 'Location';
    case 'identifier': return 'Reference';
    case 'url': return 'URL';
    default: return 'Text';
  }
}

/** Input types that must not be sanitized (structured values). */
export function shouldSkipPlainTextSanitize(
  el: Pick<HTMLInputElement, 'type' | 'dataset' | 'readOnly'>,
): boolean {
  if (el.dataset.plaintext === 'off') return true;
  if (el.readOnly) return true;
  const t = (el.type || 'text').toLowerCase();
  return [
    'password',
    'email',
    'number',
    'tel',
    'date',
    'datetime-local',
    'time',
    'month',
    'week',
    'file',
    'hidden',
    'checkbox',
    'radio',
    'color',
    'range',
    'submit',
    'button',
    'reset',
  ].includes(t);
}

export function resolvePlainTextKind(
  el: Pick<HTMLElement, 'dataset'>,
): CrmPlainTextKind {
  const k = el.dataset.plaintextKind;
  if (k === 'name' || k === 'location' || k === 'note' || k === 'identifier' || k === 'url') {
    return k;
  }
  return 'note';
}

export function validateLeadFormText(fields: {
  cust_name: string;
  location: string;
  note: string;
  deferral_notes: string;
}): string | null {
  const checks: Array<[string, CrmPlainTextKind, string, boolean]> = [
    ['Customer name', 'name', fields.cust_name, true],
    ['Location', 'location', fields.location, false],
    ['Note', 'note', fields.note, false],
    ['Timing / callback notes', 'note', fields.deferral_notes, false],
  ];
  for (const [label, kind, value, required] of checks) {
    const err = crmPlainTextError(value, kind, required);
    if (err) {
      if (err === 'required') return `${label} is required`;
      return `${label}: ${CRM_TEXT_ERROR}`;
    }
  }
  return null;
}

export function validateVisitFormText(fields: {
  note: string;
  deferral_notes: string;
  lost_reason_notes: string;
  lostReasonRequired: boolean;
}): string | null {
  const checks: Array<[string, CrmPlainTextKind, string, boolean]> = [
    ['Note', 'note', fields.note, false],
    ['Timing / callback notes', 'note', fields.deferral_notes, false],
    ['Lost reason details', 'note', fields.lost_reason_notes, fields.lostReasonRequired],
  ];
  for (const [label, kind, value, required] of checks) {
    const err = crmPlainTextError(value, kind, required);
    if (err) {
      if (err === 'required') return `${label} is required`;
      return `${label}: ${CRM_TEXT_ERROR}`;
    }
  }
  return null;
}

/** Attach once — strips emojis / invalid chars from every text field in the app. */
export function installPlainTextInputGuard(root: Document | HTMLElement = document): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (shouldSkipPlainTextSanitize(target)) return;

    const kind = resolvePlainTextKind(target);
    const cleaned = sanitizeCrmPlainText(target.value, kind);
    if (cleaned === target.value) return;

    const pos = target.selectionStart;
    target.value = cleaned;
    if (pos != null) {
      const next = Math.min(pos, cleaned.length);
      try {
        target.setSelectionRange(next, next);
      } catch {
        /* ignore for unsupported types */
      }
    }

    target.dispatchEvent(new Event('input', { bubbles: true }));
  };

  root.addEventListener('input', handler, true);
  return () => root.removeEventListener('input', handler, true);
}
