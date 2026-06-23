import { Request, Response } from 'express';
import {
  buildDailyTargetDigest,
  formatTeamDigest,
  handleBotMessage,
} from '../services/dailyTargetDigest';
import {
  getDigestDeliveryMode,
  getReplyTarget,
  getWhatsAppGroupId,
  sendDailyDigest,
  sendWhatsAppMessage,
  sendWhatsAppToMany,
} from '../services/whatsappClient';

function isAdmin(role?: string): boolean {
  return role === 'admin' || role === 'sales_admin';
}

/** GET — Meta webhook verification */
export async function verifyWhatsAppWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'voltmate-salespulse';

  if (mode === 'subscribe' && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'verification failed' });
}

/** POST — Meta Cloud API incoming messages */
export async function metaWhatsAppWebhook(req: Request, res: Response) {
  try {
    res.status(200).json({ status: 'ok' });

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message || message.type !== 'text') return;

    const from = message.from as string;
    const text = message.text?.body as string;
    const groupId = (message as { group_id?: string }).group_id || null;
    if (!text) return;

    const reply = await handleBotMessage(text);
    await sendWhatsAppMessage(getReplyTarget(from, groupId), reply);
  } catch (e) {
    console.error('[whatsapp] meta webhook error', e);
  }
}

/** POST — Twilio incoming messages (form-urlencoded) */
export async function twilioWhatsAppWebhook(req: Request, res: Response) {
  try {
    const from = req.body?.From?.replace('whatsapp:', '') || req.body?.From;
    const text = req.body?.Body;
    if (!text || !from) {
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    const reply = await handleBotMessage(String(text));
    await sendWhatsAppMessage(from, reply);

    res.type('text/xml').send('<Response></Response>');
  } catch (e) {
    console.error('[whatsapp] twilio webhook error', e);
    res.type('text/xml').send('<Response></Response>');
  }
}

/** Admin: preview digest text without sending */
export async function previewDigest(req: Request, res: Response) {
  if (!isAdmin((req as any).user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const digest = await buildDailyTargetDigest(0);
    res.json({
      bot_name: digest.botName,
      week: digest.weekLabel,
      delivery_mode: getDigestDeliveryMode(),
      group_id: getWhatsAppGroupId(),
      summary: {
        total_targets: digest.totalTargets,
        total_updated: digest.totalUpdated,
        total_pending: digest.totalPending,
        active_salespeople: digest.activeSalespeople,
      },
      message: formatTeamDigest(digest),
      salespeople: digest.salespeople.map(s => ({
        name: s.name,
        targets: s.targets.length,
        updated: s.updated.length,
        pending: s.pending.length,
        today: s.today.length,
      })),
    });
  } catch (e) {
    console.error('previewDigest', e);
    res.status(500).json({ error: 'failed' });
  }
}

/** Admin: send digest now to configured recipients or ?to= override */
export async function sendDigestNow(req: Request, res: Response) {
  if (!isAdmin((req as any).user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const digest = await buildDailyTargetDigest(0);
    const message = formatTeamDigest(digest);
    const override = req.body?.to || req.query.to;

    let results;
    if (override) {
      const targets = String(override).split(',').map(s => s.trim()).filter(Boolean);
      results = await sendWhatsAppToMany(targets, message);
    } else {
      results = await sendDailyDigest(message);
    }

    if (results.length === 0) {
      return res.status(400).json({
        error: 'No recipients. Set WHATSAPP_GROUP_ID or WHATSAPP_DAILY_TO, or pass ?to=group:YOUR_GROUP_ID',
        preview: message,
        delivery_mode: getDigestDeliveryMode(),
      });
    }

    res.json({
      delivery_mode: override ? 'override' : getDigestDeliveryMode(),
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    });
  } catch (e) {
    console.error('sendDigestNow', e);
    res.status(500).json({ error: 'failed' });
  }
}

/** Admin: simulate bot reply for a salesperson name or command */
export async function simulateBotReply(req: Request, res: Response) {
  if (!isAdmin((req as any).user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const text = req.body?.text || req.query.text;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const reply = await handleBotMessage(String(text));
    res.json({ reply });
  } catch (e) {
    console.error('simulateBotReply', e);
    res.status(500).json({ error: 'failed' });
  }
}
