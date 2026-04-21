import { Router } from 'express';
import {
  checkNetworkStatus,
  listNetworks,
  addNetwork,
  deleteNetwork,
  toggleNetwork,
} from '../controllers/networkController';

const router = Router();

// Any authenticated user — check if their current IP is on an allowed network
router.get('/status', checkNetworkStatus);

// Admin-only — manage trusted networks
router.get('/',        listNetworks);
router.post('/',       addNetwork);
router.delete('/:id',  deleteNetwork);
router.patch('/:id/toggle', toggleNetwork);

export default router;
