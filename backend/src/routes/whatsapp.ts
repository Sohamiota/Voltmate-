import { Router } from 'express';
import {
  verifyWhatsAppWebhook,
  metaWhatsAppWebhook,
  twilioWhatsAppWebhook,
  previewDigest,
  sendDigestNow,
  simulateBotReply,
} from '../controllers/whatsappBotController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/webhook/meta', verifyWhatsAppWebhook);
router.post('/webhook/meta', metaWhatsAppWebhook);
router.post('/webhook/twilio', twilioWhatsAppWebhook);

router.get('/digest/preview', authMiddleware, previewDigest);
router.post('/digest/send', authMiddleware, sendDigestNow);
router.get('/digest/send', authMiddleware, sendDigestNow);
router.post('/simulate', authMiddleware, simulateBotReply);
router.get('/simulate', authMiddleware, simulateBotReply);

export default router;
