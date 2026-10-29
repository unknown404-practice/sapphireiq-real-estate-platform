import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { Property } from '../models/Property';
import { Appointment } from '../models/Appointment';
import { AuthenticatedRequest, PropertyType, ListingType } from '../types';
import { processAndUploadImage, deleteLocalImage, deleteImage, validateImageSignature, decodeAndSanitizeImage, trackOrphanedUpload, retryOrphanedUploadCleanups, reconcileDiskOrphans } from '../services/imageService';

const ALLOWED_PROPERTY_TYPES: PropertyType[] = ['apartment', 'house', 'villa', 'plot', 'commercial'];
const ALLOWED_LISTING_TYPES: ListingType[] = ['sale', 'rent'];

// GET /api/properties
export async function getProperties(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      city,
      propertyType,
      listingType,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      bedrooms,
      search,
      sort = 'newest',
      page = '1',
      limit = '12',
      featured,
    } = req.query;

    if (city !== undefined && typeof city !== 'string') {
      res.status(400).json({ success: false, error: 'City query parameter must be a string' });
      return;
    }
    if (search !== undefined && typeof search !== 'string') {
      res.status(400).json({ success: false, error: 'Search query parameter must be a string' });
      return;
    }
    if (propertyType !== undefined && typeof propertyType !== 'string') {
      res.status(400).json({ success: false, error: 'Property type query parameter must be a string' });
      return;
    }
    if (listingType !== undefined && typeof listingType !== 'string') {
      res.status(400).json({ success: false, error: 'Listing type query parameter must be a string' });
      return;
    }
    if (sort !== undefined && typeof sort !== 'string') {
      res.status(400).json({ success: false, error: 'Sort query parameter must be a string' });
      return;
    }
    if (page !== undefined && typeof page !== 'string') {
      res.status(400).json({ success: false, error: 'Page query parameter must be a string' });
      return;
    }
    if (limit !== undefined && typeof limit !== 'string') {
      res.status(400).json({ success: false, error: 'Limit query parameter must be a string' });
      return;
    }

    const query: Record<string, any> = {
      status: 'published',
    };

    // Filter by city (case-insensitive substring with bounded length)
    if (typeof city === 'string' && city.trim()) {
      const sanitizedCity = city.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.city = { $regex: new RegExp(sanitizedCity, 'i') };
    }

    // Filter by propertyType (allowlist checked)
    if (typeof propertyType === 'string' && ALLOWED_PROPERTY_TYPES.includes(propertyType as PropertyType)) {
      query.propertyType = propertyType;
    }

    // Filter by listingType (allowlist checked)
    if (typeof listingType === 'string' && ALLOWED_LISTING_TYPES.includes(listingType as ListingType)) {
      query.listingType = listingType;
    }

    // Filter by Price range
    const numMinPrice = minPrice ? Number(minPrice) : NaN;
    const numMaxPrice = maxPrice ? Number(maxPrice) : NaN;
    if (!isNaN(numMinPrice) && numMinPrice >= 0) {
      query.price = { ...(query.price || {}), $gte: numMinPrice };
    }
    if (!isNaN(numMaxPrice) && numMaxPrice >= 0) {
      query.price = { ...(query.price || {}), $lte: numMaxPrice };
    }

    // Filter by Area range
    const numMinArea = minArea ? Number(minArea) : NaN;
    const numMaxArea = maxArea ? Number(maxArea) : NaN;
    if (!isNaN(numMinArea) && numMinArea >= 0) {
      query.areaSqFt = { ...(query.areaSqFt || {}), $gte: numMinArea };
    }
    if (!isNaN(numMaxArea) && numMaxArea >= 0) {
      query.areaSqFt = { ...(query.areaSqFt || {}), $lte: numMaxArea };
    }

    // Filter by Bedrooms
    const numBedrooms = bedrooms ? Number(bedrooms) : NaN;
    if (!isNaN(numBedrooms) && numBedrooms >= 0) {
      query.bedrooms = { $gte: numBedrooms };
    }

    // Filter by Featured
    if (featured === 'true') {
      query.featured = true;
    }

    // Text search in title, locality, description (bounded length)
    if (typeof search === 'string' && search.trim()) {
      const sanitized = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: new RegExp(sanitized, 'i') } },
        { locality: { $regex: new RegExp(sanitized, 'i') } },
        { city: { $regex: new RegExp(sanitized, 'i') } },
      ];
    }

    // Allowlisted sorting
    let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortOptions = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOptions = { price: -1 };
    } else if (sort === 'area_desc') {
      sortOptions = { areaSqFt: -1 };
    } else if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    // Bounded pagination
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [total, properties] = await Promise.all([
      Property.countDocuments(query),
      Property.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('owner', 'name email phone'),
    ]);

    res.status(200).json({
      success: true,
      data: properties,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/properties/:id
export async function getPropertyById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid property ID' });
      return;
    }

    const property = await Property.findById(id).populate('owner', 'name email phone');

    if (!property) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    // If property is draft/archived, only owner or admin can view
    if (property.status !== 'published') {
      const isOwner = req.user && (property.owner as any)._id?.toString() === req.user.id;
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        res.status(404).json({ success: false, error: 'Property not found' });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/properties
export async function createProperty(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be a valid JSON object' });
      return;
    }

    const {
      title,
      description,
      propertyType,
      listingType,
      price,
      city,
      state,
      locality,
      pincode,
      bedrooms,
      bathrooms,
      areaSqFt,
      amenities,
      images,
      status,
      featured,
    } = req.body;

    if (
      !title ||
      !description ||
      !city ||
      !state ||
      typeof title !== 'string' ||
      typeof description !== 'string' ||
      typeof city !== 'string' ||
      typeof state !== 'string'
    ) {
      res.status(400).json({
        success: false,
        error: 'Please provide valid title, description, city, and state as strings',
      });
      return;
    }

    if (!title.trim() || !description.trim() || !city.trim() || !state.trim()) {
      res.status(400).json({
        success: false,
        error: 'Please provide valid title, description, city, state, and price',
      });
      return;
    }

    if (title.trim().length > 150) {
      res.status(400).json({ success: false, error: 'Title cannot exceed 150 characters' });
      return;
    }

    if (description.trim().length > 5000) {
      res.status(400).json({ success: false, error: 'Description cannot exceed 5000 characters' });
      return;
    }

    if (city.trim().length > 100 || state.trim().length > 100) {
      res.status(400).json({ success: false, error: 'City and state cannot exceed 100 characters' });
      return;
    }

    if (locality !== undefined && typeof locality !== 'string') {
      res.status(400).json({ success: false, error: 'Locality must be a valid string' });
      return;
    }

    if (pincode !== undefined && typeof pincode !== 'string') {
      res.status(400).json({ success: false, error: 'Pincode must be a valid string' });
      return;
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      res.status(400).json({
        success: false,
        error: 'Price must be a valid non-negative number in INR',
      });
      return;
    }

    if (typeof propertyType !== 'string' || !ALLOWED_PROPERTY_TYPES.includes(propertyType as PropertyType)) {
      res.status(400).json({
        success: false,
        error: `Invalid property type. Must be one of: ${ALLOWED_PROPERTY_TYPES.join(', ')}`,
      });
      return;
    }

    if (typeof listingType !== 'string' || !ALLOWED_LISTING_TYPES.includes(listingType as ListingType)) {
      res.status(400).json({
        success: false,
        error: `Invalid listing type. Must be one of: ${ALLOWED_LISTING_TYPES.join(', ')}`,
      });
      return;
    }

    if (status !== undefined && (typeof status !== 'string' || !['draft', 'published', 'archived'].includes(status))) {
      res.status(400).json({
        success: false,
        error: 'Invalid status. Must be draft, published, or archived',
      });
      return;
    }

    if (amenities !== undefined) {
      if (!Array.isArray(amenities) && typeof amenities !== 'string') {
        res.status(400).json({ success: false, error: 'Amenities must be an array of strings or a comma-separated string' });
        return;
      }
      if (Array.isArray(amenities) && amenities.some((a) => typeof a !== 'string')) {
        res.status(400).json({ success: false, error: 'Amenities items must be strings' });
        return;
      }
    }

    if (images !== undefined && !Array.isArray(images)) {
      res.status(400).json({ success: false, error: 'Images must be an array' });
      return;
    }

    // Enforce max 4 images
    if (Array.isArray(images) && images.length > 4) {
      res.status(400).json({ success: false, error: 'Maximum 4 images allowed per property' });
      return;
    }

    const property = await Property.create({
      title: title.trim(),
      description: description.trim(),
      propertyType,
      listingType,
      price: numericPrice,
      city: city.trim(),
      state: state.trim(),
      locality: locality ? locality.trim() : undefined,
      pincode: pincode ? pincode.trim() : undefined,
      bedrooms: bedrooms !== undefined && !isNaN(Number(bedrooms)) ? Math.max(0, Number(bedrooms)) : undefined,
      bathrooms: bathrooms !== undefined && !isNaN(Number(bathrooms)) ? Math.max(0, Number(bathrooms)) : undefined,
      areaSqFt: areaSqFt !== undefined && !isNaN(Number(areaSqFt)) ? Math.max(0, Number(areaSqFt)) : undefined,
      amenities: Array.isArray(amenities)
        ? amenities.map(String).map((s: string) => s.trim()).filter(Boolean)
        : typeof amenities === 'string' && amenities
        ? (amenities as string).split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      images: Array.isArray(images) ? images : [],
      owner: req.user.id, // Strictly derived from server auth identity
      status: status || 'published',
      featured: req.user.role === 'admin' ? Boolean(featured) : false,
    });

    res.status(201).json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/properties/:id
export async function updateProperty(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid property ID' });
      return;
    }

    const property = await Property.findById(id);

    if (!property) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    // MANDATORY Server-side ownership check
    const isOwner = property.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to modify this property',
      });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be a valid JSON object' });
      return;
    }

    // Exclude owner mutation and restrict featured status to admin
    const updates = { ...req.body };
    delete updates.owner;
    delete updates._id;

    if (req.user.role !== 'admin') {
      delete updates.featured;
    }

    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string' || !updates.title.trim()) {
        res.status(400).json({ success: false, error: 'Title cannot be empty and must be a string' });
        return;
      }
      if (updates.title.trim().length > 150) {
        res.status(400).json({ success: false, error: 'Title cannot exceed 150 characters' });
        return;
      }
      updates.title = updates.title.trim();
    }

    if (updates.description !== undefined) {
      if (typeof updates.description !== 'string' || !updates.description.trim()) {
        res.status(400).json({ success: false, error: 'Description cannot be empty and must be a string' });
        return;
      }
      if (updates.description.trim().length > 5000) {
        res.status(400).json({ success: false, error: 'Description cannot exceed 5000 characters' });
        return;
      }
      updates.description = updates.description.trim();
    }

    if (updates.city !== undefined) {
      if (typeof updates.city !== 'string' || !updates.city.trim()) {
        res.status(400).json({ success: false, error: 'City cannot be empty and must be a string' });
        return;
      }
      if (updates.city.trim().length > 100) {
        res.status(400).json({ success: false, error: 'City cannot exceed 100 characters' });
        return;
      }
      updates.city = updates.city.trim();
    }

    if (updates.state !== undefined) {
      if (typeof updates.state !== 'string' || !updates.state.trim()) {
        res.status(400).json({ success: false, error: 'State cannot be empty and must be a string' });
        return;
      }
      if (updates.state.trim().length > 100) {
        res.status(400).json({ success: false, error: 'State cannot exceed 100 characters' });
        return;
      }
      updates.state = updates.state.trim();
    }

    if (updates.locality !== undefined) {
      if (typeof updates.locality !== 'string') {
        res.status(400).json({ success: false, error: 'Locality must be a valid string' });
        return;
      }
      updates.locality = updates.locality.trim();
    }

    if (updates.pincode !== undefined) {
      if (typeof updates.pincode !== 'string') {
        res.status(400).json({ success: false, error: 'Pincode must be a valid string' });
        return;
      }
      updates.pincode = updates.pincode.trim();
    }

    if (updates.price !== undefined) {
      const numPrice = Number(updates.price);
      if (isNaN(numPrice) || numPrice < 0) {
        res.status(400).json({ success: false, error: 'Price must be a valid non-negative number in INR' });
        return;
      }
      updates.price = numPrice;
    }

    if (updates.bedrooms !== undefined) {
      const numBedrooms = Number(updates.bedrooms);
      if (isNaN(numBedrooms) || numBedrooms < 0) {
        res.status(400).json({ success: false, error: 'Bedrooms must be a valid non-negative number' });
        return;
      }
      updates.bedrooms = numBedrooms;
    }

    if (updates.bathrooms !== undefined) {
      const numBathrooms = Number(updates.bathrooms);
      if (isNaN(numBathrooms) || numBathrooms < 0) {
        res.status(400).json({ success: false, error: 'Bathrooms must be a valid non-negative number' });
        return;
      }
      updates.bathrooms = numBathrooms;
    }

    if (updates.areaSqFt !== undefined) {
      const numArea = Number(updates.areaSqFt);
      if (isNaN(numArea) || numArea < 0) {
        res.status(400).json({ success: false, error: 'Area must be a valid non-negative number' });
        return;
      }
      updates.areaSqFt = numArea;
    }

    if (updates.propertyType !== undefined) {
      if (typeof updates.propertyType !== 'string' || !ALLOWED_PROPERTY_TYPES.includes(updates.propertyType as PropertyType)) {
        res.status(400).json({
          success: false,
          error: `Invalid property type. Must be one of: ${ALLOWED_PROPERTY_TYPES.join(', ')}`,
        });
        return;
      }
    }

    if (updates.listingType !== undefined) {
      if (typeof updates.listingType !== 'string' || !ALLOWED_LISTING_TYPES.includes(updates.listingType as ListingType)) {
        res.status(400).json({
          success: false,
          error: `Invalid listing type. Must be one of: ${ALLOWED_LISTING_TYPES.join(', ')}`,
        });
        return;
      }
    }

    if (updates.status !== undefined) {
      if (typeof updates.status !== 'string' || !['draft', 'published', 'archived'].includes(updates.status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status. Must be draft, published, or archived',
        });
        return;
      }
    }

    if (updates.amenities !== undefined) {
      if (!Array.isArray(updates.amenities) && typeof updates.amenities !== 'string') {
        res.status(400).json({ success: false, error: 'Amenities must be an array of strings or a comma-separated string' });
        return;
      }
      if (Array.isArray(updates.amenities) && updates.amenities.some((a: any) => typeof a !== 'string')) {
        res.status(400).json({ success: false, error: 'Amenities items must be strings' });
        return;
      }
      updates.amenities = Array.isArray(updates.amenities)
        ? updates.amenities.map(String).map((s: string) => s.trim()).filter(Boolean)
        : typeof updates.amenities === 'string' && updates.amenities
        ? updates.amenities.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
    }

    if (updates.images !== undefined && !Array.isArray(updates.images)) {
      res.status(400).json({ success: false, error: 'Images must be an array' });
      return;
    }

    if (Array.isArray(updates.images) && updates.images.length > 4) {
      res.status(400).json({ success: false, error: 'Maximum 4 images allowed per property' });
      return;
    }

    Object.assign(property, updates);
    await property.save();

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/properties/:id
export async function deleteProperty(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid property ID' });
      return;
    }

    const property = await Property.findById(id);

    if (!property) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    // MANDATORY Server-side ownership check
    const isOwner = property.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to delete this property',
      });
      return;
    }

    // Clean up uploaded image files (both local disk and remote CDN)
    if (Array.isArray(property.images)) {
      for (const img of property.images) {
        if (img) {
          await deleteImage(img as any);
        }
      }
    }

    await Property.findByIdAndDelete(id);

    // Cancel pending viewing appointments associated with deleted property
    await Appointment.updateMany(
      { property: id, status: 'pending' },
      { status: 'cancelled', notes: 'Property listing was removed by owner' }
    );

    res.status(200).json({
      success: true,
      message: 'Property successfully deleted',
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/properties/upload-images
export async function uploadPropertyImages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: 'No image files uploaded' });
      return;
    }

    if (files.length > 4) {
      res.status(400).json({ success: false, error: 'Cannot upload more than 4 images' });
      return;
    }

    // Atomic pre-validation: Full image raster decoding, pixel/dimension limits, and MIME verification
    for (const file of files) {
      await decodeAndSanitizeImage(file.buffer, file.mimetype);
    }

    // Atomic storage: persist all validated and sanitized files; rollback if any storage failure occurs
    const uploadedImages: any[] = [];
    try {
      for (const file of files) {
        const uploaded = await processAndUploadImage(file);
        uploadedImages.push(uploaded);
      }
    } catch (storageError: any) {
      // Rollback any partially persisted files
      const cleanupErrors: string[] = [];
      let trackingFailed = false;
      for (const img of uploadedImages) {
        try {
          await deleteImage(img);
        } catch (cleanupErr: any) {
          const safeId = path.basename(img.url || img.fileId || 'unknown');
          cleanupErrors.push(`Failed to remove file ${safeId}: ${cleanupErr.message}`);
          try {
            await trackOrphanedUpload(img, cleanupErr.message);
          } catch (trackErr: any) {
            trackingFailed = true;
            console.error('[UploadSecurity] CRITICAL: Failed to persist orphaned upload record:', trackErr.message);
          }
        }
      }

      if (cleanupErrors.length > 0) {
        console.error('[UploadSecurity] CRITICAL: Multi-image rollback failed to clean up all files safely:', cleanupErrors);
        const compositeError: any = new Error(
          trackingFailed
            ? `Storage failure occurred. Cleanup rollback failed, and tracking persistence failed for ${cleanupErrors.length} file(s). Manual filesystem reconciliation required.`
            : `Storage failure occurred, and cleanup rollback failed for ${cleanupErrors.length} file(s). Orphaned file(s) tracked for automated recovery.`
        );
        compositeError.statusCode = 500;
        compositeError.cleanupFailed = true;
        compositeError.orphansTracked = !trackingFailed;
        compositeError.unresolvedFiles = uploadedImages.map((img) => path.basename(img.url || img.fileId || 'unknown'));
        throw compositeError;
      }

      throw storageError;
    }

    res.status(200).json({
      success: true,
      data: uploadedImages,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/properties/reconcile-orphans
export async function reconcileOrphanedUploads(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // 1. Process tracked orphans from storage rollback failures
    const queueResult = await retryOrphanedUploadCleanups();

    // 2. Query all active property images and historical appointment thumbnails
    const properties = await Property.find({}, 'images.url').lean();
    const appointments = await Appointment.find(
      { propertyThumbnail: { $exists: true, $ne: null } },
      'propertyThumbnail'
    ).lean();

    const referencedFiles = new Set<string>();
    for (const prop of properties) {
      if (Array.isArray(prop.images)) {
        for (const img of prop.images) {
          if (img && typeof img.url === 'string') {
            referencedFiles.add(img.url);
            referencedFiles.add(path.basename(img.url));
          }
        }
      }
    }
    for (const appt of appointments) {
      if (appt && typeof appt.propertyThumbnail === 'string') {
        referencedFiles.add(appt.propertyThumbnail);
        referencedFiles.add(path.basename(appt.propertyThumbnail));
      }
    }

    // Configurable grace period: default 1 hour (3600000ms) to protect active form submissions
    let maxAgeMs = 60 * 60 * 1000;
    if (req.body && typeof req.body.maxAgeMs === 'number' && req.body.maxAgeMs >= 0) {
      maxAgeMs = req.body.maxAgeMs;
    }

    const diskResult = await reconcileDiskOrphans(referencedFiles, maxAgeMs);

    res.status(200).json({
      success: true,
      data: {
        processed: queueResult.processed,
        resolved: queueResult.resolved,
        failed: queueResult.failed,
        queue: queueResult,
        diskSweeper: diskResult,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/properties/user/mine
export async function getMyProperties(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const properties = await Property.find({ owner: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: properties,
    });
  } catch (error) {
    next(error);
  }
}
