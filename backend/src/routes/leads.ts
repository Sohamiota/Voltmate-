import { Router } from 'express';
import { createLead, listLeads, deleteLead, exportLeadsCSV } from '../controllers/leadsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/', authMiddleware, createLead);
router.get('/', authMiddleware, listLeads);
router.delete('/:id', authMiddleware, deleteLead);
router.get('/export/csv', authMiddleware, exportLeadsCSV);

export default router;

