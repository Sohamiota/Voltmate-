import { Router } from 'express';
import {
  createDocument,
  getDocument,
  getDocumentFile,
  getNextNumber,
  listDocuments,
} from '../controllers/billingController';

const router = Router();

router.get('/next-number', getNextNumber);
router.get('/', listDocuments);
router.get('/:id/file', getDocumentFile);
router.get('/:id', getDocument);
router.post('/', createDocument);

export default router;
