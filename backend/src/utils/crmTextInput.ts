/** Plain-text rules for CRM / EMS free-text fields (no emojis / stray symbols). */

export type CrmPlainTextKind = 'name' | 'location' | 'note' | 'identifier' | 'url';

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\uFEFF]/;

const DASHES = '\\p{Pd}';

const STRIP_RE: Record<CrmPlainTextKind, RegExp> = {
  name: new RegExp(`[^\\p{L}\\p{M}\\s.'\\-${DASHES}]`, 'gu'),
  location: new RegExp(`[^\\p{L}\\p{M}\\d\\s.,\\-/${DASHES}()&]`, 'gu'),
  note: new RegExp(`[^\\p{L}\\p{M}\\d\\s.,;:'"!?\\-/${DASHES}()%&+]`, 'gu'),
  identifier: new RegExp(`[^\\p{L}\\p{M}\\d\\s.\\-_/${DASHES}]`, 'gu'),
  url: new RegExp(`[^\\p{L}\\p{M}\\d\\s.\\-_/:${DASHES}@%&?=#]`, 'gu'),
};

export const CRM_TEXT_ERROR =
  'contains emojis or disallowed characters';

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
    return CRM_TEXT_ERROR;
  }
  const sanitized = sanitizeCrmPlainText(trimmed, kind);
  if (sanitized !== trimmed) return CRM_TEXT_ERROR;
  return null;
}
