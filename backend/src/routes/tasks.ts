import { Router } from 'express';
import { getTodayTask, createTask, updateTask, approveTask, listTasks, getTaskHistory } from '../controllers/tasksController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.get('/today',           authMiddleware, getTodayTask);
router.get('/',                authMiddleware, listTasks);
router.post('/',               authMiddleware, createTask);
router.patch('/:id',           authMiddleware, updateTask);
router.patch('/:id/approval',  authMiddleware, approveTask);
router.get('/:id/history',     authMiddleware, getTaskHistory);

export default router;
