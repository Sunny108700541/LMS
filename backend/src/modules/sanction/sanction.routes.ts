import { Router } from 'express';
import { sanctionController } from './sanction.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { paginationSchema } from '../../utils/pagination';
import { objectIdSchema } from '../applications/application.validation';
import { approveLoanSchema, rejectLoanSchema } from './sanction.validation';
import { Role } from '../../types/enums';

const router = Router();

router.use(authenticate, authorize(Role.SANCTION));

router.get('/queue', validate(paginationSchema, 'query'), sanctionController.queue);
router.get('/stats', sanctionController.stats);
router.patch(
  '/loans/:id/approve',
  validate(objectIdSchema, 'params'),
  validate(approveLoanSchema),
  sanctionController.approve,
);
router.patch(
  '/loans/:id/reject',
  validate(objectIdSchema, 'params'),
  validate(rejectLoanSchema),
  sanctionController.reject,
);

export const sanctionRoutes = router;
