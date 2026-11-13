import { Router } from 'express';
import * as ctrl from '../controllers/productController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { productListRules, productRules } from '../validators/catalogValidators.js';

const router = Router();
router.get('/', validate(productListRules), ctrl.list);
router.get('/id/:id', ctrl.getById);
router.get('/:slug', ctrl.getBySlug);
router.post('/', authenticate, authorize('admin'), validate(productRules), ctrl.create);
router.put('/:id', authenticate, authorize('admin'), ctrl.update);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

export default router;
