import { Router } from 'express';
import authRoutes from './authRoutes';
import propertyRoutes from './propertyRoutes';
import appointmentRoutes from './appointmentRoutes';
import healthRoutes from './healthRoutes';
import { getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.get('/users/me', authenticate, getMe);
router.use('/properties', propertyRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
