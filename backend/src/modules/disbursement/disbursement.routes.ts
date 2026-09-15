import { Router } from 'express';
import { disbursementController } from './disbursement.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { paginationSchema } from '../../utils/pagination';
import { objectIdSchema } from '../applications/application.validation';
import { disburseSchema } from './disbursement.validation';
import { Role } from '../../types/enums';

const router = Router();

router.use(authenticate, authorize(Role.DISBURSEMENT));

router.get('/queue', validate(paginationSchema, 'query'), disbursementController.queue);
router.get('/stats', disbursementController.stats);
router.patch(
  '/loans/:id/disburse',
  validate(objectIdSchema, 'params'),
  validate(disburseSchema),
  disbursementController.disburse,
);

export const disbursementRoutes = router;
