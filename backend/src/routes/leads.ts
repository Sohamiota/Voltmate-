import { Router } from 'express';
import { createLead, updateLead, listLeads, deleteLead, exportLeadsCSV } from '../controllers/leadsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/export/csv', authMiddleware, exportLeadsCSV);
router.post('/', authMiddleware, createLead);
router.get('/', authMiddleware, listLeads);
router.put('/:id', authMiddleware, updateLead);
router.delete('/:id', authMiddleware, deleteLead);

export default router;

