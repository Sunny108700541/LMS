import { Router } from 'express';
import { collectionController } from './collection.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { paginationSchema } from '../../utils/pagination';
import { objectIdSchema } from '../applications/application.validation';
import { recordPaymentSchema } from './collection.validation';
import { Role } from '../../types/enums';

const router = Router();

router.use(authenticate, authorize(Role.COLLECTION));

router.get('/queue', validate(paginationSchema, 'query'), collectionController.queue);
router.get('/stats', collectionController.stats);
router.get('/loans/:id/payments', validate(objectIdSchema, 'params'), collectionController.payments);
router.post(
  '/loans/:id/payments',
  validate(objectIdSchema, 'params'),
  validate(recordPaymentSchema),
  collectionController.recordPayment,
);

export const collectionRoutes = router;
