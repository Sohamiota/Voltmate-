import { Router } from 'express';
import { createLead, updateLead, listLeads, deleteLead, exportLeadsCSV } from '../controllers/leadsController';
import { authMiddleware } from '../middlewares/auth';
import { exportLimiter } from '../middlewares/rateLimits';
import { heavyRequestGuard } from '../middlewares/heavyRequestGuard';

const router = Router();

router.get('/export/csv', authMiddleware, exportLimiter, heavyRequestGuard, exportLeadsCSV);
router.post('/', authMiddleware, createLead);
router.get('/', authMiddleware, heavyRequestGuard, listLeads);
router.put('/:id', authMiddleware, updateLead);
router.delete('/:id', authMiddleware, deleteLead);

export default router;

