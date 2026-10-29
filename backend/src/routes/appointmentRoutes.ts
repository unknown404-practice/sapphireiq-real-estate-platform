import { Router } from 'express';
import {
  createGuestAppointment,
  createAuthenticatedAppointment,
  getMyAppointments,
  cancelAppointment,
  updateAppointmentStatus,
} from '../controllers/appointmentController';
import { authenticate } from '../middleware/auth';
import { guestBookingLimiter } from '../middleware/rateLimiter';

const router = Router();

// Guest booking (public, rate-limited)
router.post('/guest', guestBookingLimiter, createGuestAppointment);

// Authenticated booking & user appointments
router.post('/', authenticate, createAuthenticatedAppointment);
router.get('/mine', authenticate, getMyAppointments);
router.patch('/:id/cancel', authenticate, cancelAppointment);
router.patch('/:id/status', authenticate, updateAppointmentStatus);

export default router;
