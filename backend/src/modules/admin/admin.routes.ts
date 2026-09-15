import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../../middleware/authenticate';
import { adminOnly } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { paginationSchema } from '../../utils/pagination';
import { objectIdSchema } from '../applications/application.validation';
import { createUserSchema } from '../auth/auth.validation';
import { listLoansQuerySchema, listUsersQuerySchema, setActiveSchema } from './admin.validation';

const router = Router();

router.use(authenticate, adminOnly);

router.post('/users', validate(createUserSchema), adminController.createUser);
router.get('/users', validate(listUsersQuerySchema, 'query'), adminController.listUsers);
router.patch(
  '/users/:id/status',
  validate(objectIdSchema, 'params'),
  validate(setActiveSchema),
  adminController.setUserActive,
);
router.get('/overview', adminController.overview);
router.get('/loans', validate(listLoansQuerySchema, 'query'), adminController.loans);
router.get('/audit-logs', validate(paginationSchema, 'query'), adminController.auditLogs);

export const adminRoutes = router;
