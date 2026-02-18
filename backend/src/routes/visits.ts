import { Router } from 'express';
import { createVisit, listVisits, exportVisitsCSV } from '../controllers/visitsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/', authMiddleware, createVisit);
router.get('/', authMiddleware, listVisits);
router.get('/export/csv', authMiddleware, exportVisitsCSV);

export default router;

