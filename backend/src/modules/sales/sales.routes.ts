import { Router } from 'express';
import { salesController } from './sales.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { paginationSchema } from '../../utils/pagination';
import { Role } from '../../types/enums';

const router = Router();

router.use(authenticate, authorize(Role.SALES));

router.get('/leads', validate(paginationSchema, 'query'), salesController.leads);
router.get('/stats', salesController.stats);

export const salesRoutes = router;
