import { Router } from 'express';
import {
  createVisit,
  updateVisit,
  deleteVisit,
  listVisits,
  exportVisitsCSV,
  listVisibleVisits,
  exportVisibleVisitsCSV,
  listOverdueVisits,
} from '../controllers/visitsController';
import { authMiddleware } from '../middlewares/auth';
import { exportLimiter } from '../middlewares/rateLimits';

const router = Router();

router.get('/report/export/csv', authMiddleware, exportLimiter, exportVisibleVisitsCSV);
router.get('/report',            authMiddleware, listVisibleVisits);
router.get('/overdue',           authMiddleware, listOverdueVisits);
router.get('/export/csv',        authMiddleware, exportLimiter, exportVisitsCSV);
router.post('/', authMiddleware, createVisit);
router.get('/', authMiddleware, listVisits);
router.put('/:id', authMiddleware, updateVisit);
router.delete('/:id', authMiddleware, deleteVisit);

export default router;

