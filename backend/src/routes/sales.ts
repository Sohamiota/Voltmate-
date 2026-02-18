import { Router } from 'express';
import { salesByEmployee } from '../controllers/salesController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/by-employee', authMiddleware, salesByEmployee);

export default router;

