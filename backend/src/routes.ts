import { Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { applicationRoutes } from './modules/applications/application.routes';
import { loanRoutes } from './modules/loans/loan.routes';
import { salesRoutes } from './modules/sales/sales.routes';
import { sanctionRoutes } from './modules/sanction/sanction.routes';
import { disbursementRoutes } from './modules/disbursement/disbursement.routes';
import { collectionRoutes } from './modules/collection/collection.routes';
import { adminRoutes } from './modules/admin/admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/applications', applicationRoutes);
router.use('/loans', loanRoutes);

// Operations dashboard — one router per module, each gated by its own role.
router.use('/sales', salesRoutes);
router.use('/sanction', sanctionRoutes);
router.use('/disbursement', disbursementRoutes);
router.use('/collection', collectionRoutes);
router.use('/admin', adminRoutes);

export const apiRouter = router;
