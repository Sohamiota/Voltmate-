import { Router } from 'express';
import { listActivityLog } from '../controllers/activityLogController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/', authMiddleware, listActivityLog);

export default router;
