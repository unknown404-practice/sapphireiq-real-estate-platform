import { Router } from 'express';
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadPropertyImages,
  getMyProperties,
  reconcileOrphanedUploads,
} from '../controllers/propertyController';
import { authenticate, optionalAuth, authorizeAdmin } from '../middleware/auth';
import { upload } from '../services/imageService';

const router = Router();

// Public routes
router.get('/', getProperties);
router.get('/user/mine', authenticate, getMyProperties);
router.get('/:id', optionalAuth, getPropertyById);

// Protected routes (Owner / Admin)
router.post('/', authenticate, createProperty);
router.patch('/:id', authenticate, updateProperty);
router.put('/:id', authenticate, updateProperty);
router.delete('/:id', authenticate, deleteProperty);
router.post('/upload-images', authenticate, upload.array('images', 4), uploadPropertyImages);
router.post('/reconcile-orphans', authenticate, authorizeAdmin, reconcileOrphanedUploads);

export default router;
