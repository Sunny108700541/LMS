import { Router } from 'express';
import { applicationController } from './application.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { uploadSingle } from '../../middleware/upload';
import { uploadLimiter } from '../../middleware/rateLimit';
import { Role } from '../../types/enums';
import { objectIdSchema, personalDetailsSchema } from './application.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/personal-details',
  authorize(Role.BORROWER),
  validate(personalDetailsSchema),
  applicationController.submitPersonalDetails,
);

router.post(
  '/:id/documents',
  authorize(Role.BORROWER),
  uploadLimiter,
  validate(objectIdSchema, 'params'),
  uploadSingle('file'),
  applicationController.uploadSalarySlip,
);

router.get('/me', authorize(Role.BORROWER), applicationController.myApplication);
router.get('/me/history', authorize(Role.BORROWER), applicationController.myApplicationHistory);

// Borrowers (own file) and reviewing roles; ownership is re-checked in the service.
router.get(
  '/documents/:id/url',
  validate(objectIdSchema, 'params'),
  applicationController.documentUrl,
);

export const applicationRoutes = router;
