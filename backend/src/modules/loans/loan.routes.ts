import { Router } from 'express';
import { loanController } from './loan.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from '../../types/enums';
import {
  loanApplicationSchema,
  objectIdSchema,
  quoteQuerySchema,
} from '../applications/application.validation';

const router = Router();

router.use(authenticate);

router.get('/quote', validate(quoteQuerySchema, 'query'), loanController.quote);
router.post('/', authorize(Role.BORROWER), validate(loanApplicationSchema), loanController.apply);
router.get('/me', authorize(Role.BORROWER), loanController.myLoans);
router.get('/:id', validate(objectIdSchema, 'params'), loanController.getOne);

export const loanRoutes = router;
