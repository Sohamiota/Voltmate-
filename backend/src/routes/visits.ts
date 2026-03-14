import { Router } from 'express';
import { createVisit, updateVisit, deleteVisit, listVisits, exportVisitsCSV } from '../controllers/visitsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/export/csv', authMiddleware, exportVisitsCSV);
router.post('/', authMiddleware, createVisit);
router.get('/', authMiddleware, listVisits);
router.put('/:id', authMiddleware, updateVisit);
router.delete('/:id', authMiddleware, deleteVisit);

export default router;

