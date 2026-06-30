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
  getAnalytics,
} from '../controllers/visitsController';
import { authMiddleware } from '../middlewares/auth';
import { exportLimiter } from '../middlewares/rateLimits';
import { heavyRequestGuard } from '../middlewares/heavyRequestGuard';

const router = Router();

router.get('/report/analytics',  authMiddleware, getAnalytics);
router.get('/report/export/csv', authMiddleware, exportLimiter, heavyRequestGuard, exportVisibleVisitsCSV);
router.get('/report',            authMiddleware, heavyRequestGuard, listVisibleVisits);
router.get('/overdue',           authMiddleware, listOverdueVisits);
router.get('/export/csv',        authMiddleware, exportLimiter, heavyRequestGuard, exportVisitsCSV);
router.post('/', authMiddleware, createVisit);
router.get('/', authMiddleware, heavyRequestGuard, listVisits);
router.put('/:id', authMiddleware, updateVisit);
router.delete('/:id', authMiddleware, deleteVisit);

export default router;

