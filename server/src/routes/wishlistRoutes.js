import { Router } from 'express';
import * as ctrl from '../controllers/wishlistController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.get('/', authenticate, ctrl.list);
router.post('/', authenticate, ctrl.add);
router.delete('/:productId', authenticate, ctrl.remove);
router.get('/check/:productId', authenticate, ctrl.check);

export default router;

