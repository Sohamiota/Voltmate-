import cron from 'node-cron';
import { buildDailyTargetDigest, formatTeamDigest } from '../services/dailyTargetDigest';
import { getDigestDeliveryMode, sendDailyDigest } from '../services/whatsappClient';

export async function runDailyTargetWhatsApp(): Promise<void> {
  if (getDigestDeliveryMode() === 'none') {
    console.log('[dailyTargetWhatsApp] Set WHATSAPP_GROUP_ID or WHATSAPP_DAILY_TO, skipping');
    return;
  }

  console.log(`[dailyTargetWhatsApp] sending (${getDigestDeliveryMode()} mode)`);
  const digest = await buildDailyTargetDigest(0);
  const message = formatTeamDigest(digest);
  const results = await sendDailyDigest(message);
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`[dailyTargetWhatsApp] done — sent: ${ok}, failed: ${fail}`);
}

export function startDailyTargetWhatsAppJob(): void {
  const schedule = process.env.WHATSAPP_DAILY_CRON || '0 9 * * 1-6';
  cron.schedule(
    schedule,
    () => {
      runDailyTargetWhatsApp().catch(err => console.error('[dailyTargetWhatsApp] error:', err));
    },
    { timezone: 'Asia/Kolkata' },
  );
  console.log(`[dailyTargetWhatsApp] cron scheduled — ${schedule} IST (${process.env.WHATSAPP_BOT_NAME || 'SalesPulse'})`);
}
