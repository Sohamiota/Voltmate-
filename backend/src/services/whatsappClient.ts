export interface SendResult {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  target?: 'individual' | 'group';
}

function normalizePhone(to: string): string {
  const digits = to.replace(/\D/g, '');
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** Meta WhatsApp group ID (from Groups API or webhook). */
export function getWhatsAppGroupId(): string | null {
  const id = process.env.WHATSAPP_GROUP_ID?.trim();
  return id || null;
}

export function getDailyRecipients(): string[] {
  const raw = process.env.WHATSAPP_DAILY_TO || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function getDigestDeliveryMode(): 'group' | 'individual' | 'none' {
  if (getWhatsAppGroupId()) return 'group';
  if (getDailyRecipients().length > 0) return 'individual';
  return 'none';
}

/** Parse `group:abc123` or bare group id vs phone number. */
export function parseRecipient(to: string): { type: 'individual' | 'group'; id: string } {
  const trimmed = to.trim();
  if (trimmed.toLowerCase().startsWith('group:')) {
    return { type: 'group', id: trimmed.slice(6).trim() };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 15 && /^\+?\d[\d\s-]+$/.test(trimmed.replace(/\s/g, ''))) {
    return { type: 'individual', id: normalizePhone(trimmed) };
  }
  return { type: 'group', id: trimmed };
}

/** Send WhatsApp text. Supports Meta Cloud API (individual + group), Twilio, or log fallback. */
export async function sendWhatsAppMessage(to: string, body: string): Promise<SendResult> {
  const provider = (process.env.WHATSAPP_PROVIDER || 'log').toLowerCase();
  const recipient = parseRecipient(to);

  if (provider === 'meta') {
    return sendViaMeta(recipient, body);
  }
  if (provider === 'twilio') {
    if (recipient.type === 'group') {
      return {
        ok: false,
        provider: 'twilio',
        target: 'group',
        error: 'Twilio WhatsApp does not support group messages. Use WHATSAPP_PROVIDER=meta with WHATSAPP_GROUP_ID.',
      };
    }
    return sendViaTwilio(recipient.id, body);
  }

  console.log(`[whatsapp:${provider}] → ${recipient.type}:${recipient.id}\n${body}\n---`);
  return { ok: true, provider: 'log', target: recipient.type };
}

async function sendViaMeta(
  recipient: { type: 'individual' | 'group'; id: string },
  body: string,
): Promise<SendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    return {
      ok: false,
      provider: 'meta',
      target: recipient.type,
      error: 'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing',
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: recipient.type,
        to: recipient.id,
        type: 'text',
        text: { body: body.slice(0, 4096) },
      }),
    });
    const json = await res.json() as { messages?: { id: string }[]; error?: unknown };
    if (!res.ok) {
      return {
        ok: false,
        provider: 'meta',
        target: recipient.type,
        error: JSON.stringify(json?.error || json),
      };
    }
    return {
      ok: true,
      provider: 'meta',
      target: recipient.type,
      messageId: json?.messages?.[0]?.id,
    };
  } catch (e) {
    return { ok: false, provider: 'meta', target: recipient.type, error: String(e) };
  }
}

async function sendViaTwilio(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !authToken || !from) {
    return { ok: false, provider: 'twilio', target: 'individual', error: 'Twilio env vars missing' };
  }

  const phone = normalizePhone(to);
  const toAddr = to.startsWith('whatsapp:')
    ? to
    : `whatsapp:+${phone.startsWith('91') ? phone : `91${phone}`}`;

  try {
    const params = new URLSearchParams({
      From: from,
      To: toAddr,
      Body: body.slice(0, 1600),
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const json = await res.json() as { sid?: string; message?: string };
    if (!res.ok) {
      return { ok: false, provider: 'twilio', target: 'individual', error: json?.message || JSON.stringify(json) };
    }
    return { ok: true, provider: 'twilio', target: 'individual', messageId: json.sid };
  } catch (e) {
    return { ok: false, provider: 'twilio', target: 'individual', error: String(e) };
  }
}

export async function sendWhatsAppToMany(recipients: string[], body: string): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const to of recipients) {
    const trimmed = to.trim();
    if (!trimmed) continue;
    results.push(await sendWhatsAppMessage(trimmed, body));
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

/** Send daily digest to WHATSAPP_GROUP_ID (preferred) or WHATSAPP_DAILY_TO numbers. */
export async function sendDailyDigest(body: string): Promise<SendResult[]> {
  const groupId = getWhatsAppGroupId();
  if (groupId) {
    return [await sendWhatsAppMessage(`group:${groupId}`, body)];
  }
  const recipients = getDailyRecipients();
  if (recipients.length === 0) return [];
  return sendWhatsAppToMany(recipients, body);
}

/** Resolve webhook reply target — reply in group if message came from a group. */
export function getReplyTarget(from: string, groupId?: string | null): string {
  if (groupId) return `group:${groupId}`;
  return from;
}
