import { Router } from 'express';
import { syncSalesforce } from '../controllers/salesforceController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Salesforce sync endpoint intentionally disabled (returns 410)
router.post('/salesforce', authMiddleware, syncSalesforce);

export default router;

