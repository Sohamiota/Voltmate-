import { Router } from 'express';
import { createLead, updateLead, listLeads, deleteLead, exportLeadsCSV } from '../controllers/leadsController';
import { authMiddleware } from '../middlewares/auth';
import { exportLimiter } from '../middlewares/rateLimits';

const router = Router();

router.get('/export/csv', authMiddleware, exportLimiter, exportLeadsCSV);
router.post('/', authMiddleware, createLead);
router.get('/', authMiddleware, listLeads);
router.put('/:id', authMiddleware, updateLead);
router.delete('/:id', authMiddleware, deleteLead);

export default router;

