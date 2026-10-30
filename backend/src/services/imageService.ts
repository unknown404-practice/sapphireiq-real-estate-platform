import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import ImageKit, { toFile } from '@imagekit/nodejs';
import sharp, { Metadata } from 'sharp';
import { env } from '../config/env';
import { IPropertyImage } from '../types';
import { OrphanedUpload, IOrphanedUpload } from '../models/OrphanedUpload';
import { Property } from '../models/Property';
import { Appointment } from '../models/Appointment';

// Ensure local uploads directory exists
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Memory storage for inspection and dispatching to ImageKit or Disk
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 4, // Max 4 files
    fields: 10, // Max non-file fields
    fieldNameSize: 100, // Max field name size 100 bytes
    fieldSize: 1 * 1024 * 1024, // Max field value size 1MB
    parts: 20, // Max total parts (fields + files)
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const mimetype = (file.mimetype || '').toLowerCase();
    if (allowedMimeTypes.includes(mimetype)) {
      cb(null, true);
    } else {
      const error: any = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      error.statusCode = 400;
      cb(error);
    }
  },
});

// ImageKit client initialization if credentials are provided
let imageKitClient: ImageKit | null = null;
if (env.IMAGEKIT_PRIVATE_KEY) {
  imageKitClient = new ImageKit({
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    ...(env.IMAGEKIT_PUBLIC_KEY ? { publicKey: env.IMAGEKIT_PUBLIC_KEY } : {}),
    ...(env.IMAGEKIT_URL_ENDPOINT ? { urlEndpoint: env.IMAGEKIT_URL_ENDPOINT } : {}),
  });
}

export function isDurableStorageConfigured(): boolean {
  return imageKitClient !== null;
}

export function getImageKitClient(): ImageKit | null {
  return imageKitClient;
}

export function setImageKitClientForTesting(client: ImageKit | null): void {
  imageKitClient = client;
}

export interface ImageValidationResult {
  valid: boolean;
  detectedType?: 'image/jpeg' | 'image/png' | 'image/webp';
  error?: string;
}

export interface ProcessedImageData {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: '.jpg' | '.png' | '.webp';
  width: number;
  height: number;
}

export const MAX_IMAGE_DIMENSION = 4096; // Max 4096px width or height
export const MAX_IMAGE_PIXELS = 16 * 1024 * 1024; // Max 16 Megapixels (decompression bomb protection)

/**
 * Validates actual binary payload (magic bytes / file signatures)
 * Rejects disguised files (HTML/JS/executable in image disguise) and truncated/corrupted images.
 */
export function validateImageSignature(buffer: Buffer): ImageValidationResult {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { valid: false, error: 'Empty or invalid file payload' };
  }

  // Minimum required header size to detect valid image markers
  if (buffer.length < 4) {
    return { valid: false, error: 'File is too small or truncated to be a valid image' };
  }

  // Check JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedType: 'image/jpeg' };
  }

  // Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedType: 'image/png' };
  }

  // Check WebP magic bytes: 'RIFF' at 0-3 and 'WEBP' at 8-11
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedType: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Invalid file signature. File content does not match a valid JPEG, PNG, or WebP image.',
  };
}

/**
 * Full image decoding, validation, decompression bomb check, metadata stripping,
 * and safe re-encoding using sharp.
 */
export async function decodeAndSanitizeImage(
  buffer: Buffer,
  declaredMimeType?: string
): Promise<ProcessedImageData> {
  // Step 1: Magic byte verification
  const sig = validateImageSignature(buffer);
  if (!sig.valid || !sig.detectedType) {
    const error: any = new Error(sig.error || 'Corrupted or invalid image header.');
    error.statusCode = 400;
    throw error;
  }

  // Step 2: MIME compatibility check
  const normMime = (declaredMimeType || '').toLowerCase();
  const allowedMap: Record<string, string[]> = {
    'image/jpeg': ['image/jpeg', 'image/jpg'],
    'image/png': ['image/png'],
    'image/webp': ['image/webp'],
  };
  if (normMime && !allowedMap[sig.detectedType]?.includes(normMime)) {
    const error: any = new Error(
      `MIME type mismatch: declared '${declaredMimeType}' but file signature is '${sig.detectedType}'.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Step 3: Full decoding with sharp (enforces pixel limit for decompression bombs)
  const sharpInstance = sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  });

  let metadata: Metadata;
  try {
    metadata = await sharpInstance.metadata();
  } catch (err: any) {
    const error: any = new Error('Corrupted image payload. Failed to parse image structure.');
    error.statusCode = 400;
    throw error;
  }

  if (!metadata.width || !metadata.height) {
    const error: any = new Error('Invalid image dimensions. Unable to decode image raster.');
    error.statusCode = 400;
    throw error;
  }

  // Step 4: Dimension boundary validation
  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    const error: any = new Error(
      `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum allowed limit of ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.`
    );
    error.statusCode = 400;
    throw error;
  }

  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    const error: any = new Error(
      `Image pixel count exceeds maximum allowed limit of 16 Megapixels.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Step 5: Strip metadata (polyglots / EXIF / XMP) and re-encode
  let sanitizedBuffer: Buffer;
  let ext: '.jpg' | '.png' | '.webp';

  try {
    if (sig.detectedType === 'image/jpeg') {
      ext = '.jpg';
      sanitizedBuffer = await sharp(buffer)
        .rotate()
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    } else if (sig.detectedType === 'image/png') {
      ext = '.png';
      sanitizedBuffer = await sharp(buffer)
        .png({ compressionLevel: 8 })
        .toBuffer();
    } else {
      ext = '.webp';
      sanitizedBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
    }
  } catch (err: any) {
    const error: any = new Error('Failed to process and decode image stream. Corrupted image data.');
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer: sanitizedBuffer,
    mimeType: sig.detectedType,
    extension: ext,
    width: metadata.width,
    height: metadata.height,
  };
}

export async function processAndUploadImage(
  file: Express.Multer.File
): Promise<IPropertyImage> {
  // Fully decode, validate raster, strip metadata, and re-encode
  const processed = await decodeAndSanitizeImage(file.buffer, file.mimetype);

  // If ImageKit configured, upload sanitized buffer via modern @imagekit/nodejs SDK with retries
  if (imageKitClient) {
    let lastError: any = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const uploadable = await toFile(processed.buffer, fileName, { type: processed.mimeType });
        const response = await imageKitClient.files.upload({
          file: uploadable,
          fileName,
          folder: '/sapphireiq/properties',
        });
        return {
          url: response.url || '',
          fileId: response.fileId || '',
          caption: file.originalname,
        };
      } catch (err: any) {
        lastError = err;
        console.error(`[ImageService] ImageKit upload attempt ${attempt}/${maxRetries} failed:`, err.message);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') {
      const error: any = new Error(
        `Durable cloud image storage upload failed (${lastError?.message || 'Unknown network error'}). Ephemeral disk fallback is strictly disabled in production.`
      );
      error.statusCode = 503;
      throw error;
    }
  } else if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') {
    const error: any = new Error(
      'Permanent cloud storage (ImageKit) is not configured. Ephemeral local disk fallback on Render is strictly disabled in production.'
    );
    error.statusCode = 503;
    throw error;
  }

  // Local storage fallback with verified extension and sanitized buffer (development/testing only)
  const safeRandomId = crypto.randomBytes(8).toString('hex');
  const filename = `${Date.now()}-${safeRandomId}${processed.extension}`;
  const filepath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filepath, processed.buffer);

  return {
    url: `/uploads/${filename}`,
    fileId: filename,
    caption: file.originalname,
  };
}

export async function deleteLocalImage(urlOrFileId: string): Promise<void> {
  try {
    const filename = path.basename(urlOrFileId);
    // Sanity check to avoid directory traversal
    if (!filename || filename === '.' || filename === '..') return;
    const filepath = path.join(uploadsDir, filename);
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  } catch (err: any) {
    console.error('[ImageService] CRITICAL: Failed to delete local image file:', err.message);
    throw err;
  }
}

export async function deleteImage(image: IPropertyImage): Promise<void> {
  if (!image) return;

  // If remote ImageKit fileId exists and client is initialized
  if (imageKitClient && image.fileId && (!image.url || !image.url.startsWith('/uploads/'))) {
    try {
      await imageKitClient.files.delete(image.fileId);
    } catch (err: any) {
      console.error('[ImageService] CRITICAL: Failed to delete remote ImageKit file:', err.message);
      throw err;
    }
  }

  // If local file
  if (typeof image.url === 'string' && image.url.startsWith('/uploads/')) {
    await deleteLocalImage(image.url);
  }
}

/**
 * Records an orphaned upload that failed immediate rollback deletion.
 * Securely tracks the file ID and location without exposing sensitive data.
 */
export async function trackOrphanedUpload(
  image: IPropertyImage,
  errorReason: string
): Promise<IOrphanedUpload> {
  const safeFileId = path.basename(image.url || image.fileId || 'unknown');
  const safeUrl = image.url || `/uploads/${safeFileId}`;

  const record = await OrphanedUpload.create({
    fileId: safeFileId,
    url: safeUrl,
    errorReason: (errorReason || 'Unknown cleanup failure').substring(0, 500),
    status: 'pending',
    retryCount: 0,
    lastAttemptAt: new Date(),
  });

  return record;
}

/**
 * Reconciliation worker: Retries removal of pending orphaned files.
 * Marks successfully purged files as 'resolved' and increments retry counters.
 * Atomic state transition guarantees idempotency and concurrency protection.
 */
export async function retryOrphanedUploadCleanups(): Promise<{
  processed: number;
  resolved: number;
  failed: number;
}> {
  const staleProcessingTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes stale threshold

  // Find eligible orphans (pending, or stale processing from worker crash)
  const candidateOrphans = await OrphanedUpload.find({
    $or: [
      { status: 'pending' },
      { status: 'processing', lastAttemptAt: { $lt: staleProcessingTime } },
    ],
  }).limit(50);

  let processed = 0;
  let resolved = 0;
  let failed = 0;

  for (const candidate of candidateOrphans) {
    // Atomically claim the record to prevent concurrent worker duplication
    const orphan = await OrphanedUpload.findOneAndUpdate(
      {
        _id: candidate._id,
        $or: [
          { status: 'pending' },
          { status: 'processing', lastAttemptAt: { $lt: staleProcessingTime } },
        ],
      },
      {
        status: 'processing',
        lastAttemptAt: new Date(),
      },
      { new: true }
    );

    // If another concurrent worker already claimed this record, skip it
    if (!orphan) {
      continue;
    }

    processed++;

    try {
      if (typeof orphan.url === 'string' && orphan.url.startsWith('/uploads/')) {
        const rawRelative = orphan.url.slice('/uploads/'.length);

        // Strict path traversal and identifier sanity check
        if (
          !rawRelative ||
          rawRelative.includes('..') ||
          rawRelative.includes('/') ||
          rawRelative.includes('\\')
        ) {
          throw new Error('Path traversal attempt blocked: invalid file path identifier');
        }

        const normalizedUploadsDir = path.resolve(uploadsDir);
        const resolvedPath = path.resolve(uploadsDir, rawRelative);

        // Ensure target is strictly within uploadsDir
        if (!resolvedPath.startsWith(normalizedUploadsDir + path.sep)) {
          throw new Error('Path traversal attempt blocked');
        }

        if (fs.existsSync(resolvedPath)) {
          await fs.promises.unlink(resolvedPath);
        }
      } else if (orphan.fileId) {
        // Alphanumeric validation for remote identifiers
        if (!/^[a-zA-Z0-9_.-]+$/.test(orphan.fileId)) {
          throw new Error('Invalid remote storage file identifier format');
        }
        if (imageKitClient) {
          await imageKitClient.files.delete(orphan.fileId);
        }
      } else {
        throw new Error('Invalid orphan record: missing valid url or fileId');
      }

      orphan.status = 'resolved';
      orphan.lastAttemptAt = new Date();
      await orphan.save();
      resolved++;
    } catch (err: any) {
      orphan.retryCount += 1;
      orphan.lastAttemptAt = new Date();
      // If retry limit reached (5 retries) or security violation / invalid format, mark as failed
      if (
        orphan.retryCount >= 5 ||
        err.message?.includes('traversal') ||
        err.message?.includes('Invalid')
      ) {
        orphan.status = 'failed';
      } else {
        orphan.status = 'pending'; // Re-queue for next retry cycle
      }
      orphan.errorReason = (err.message || 'Retry failed').substring(0, 500);
      await orphan.save();
      failed++;
    }
  }

  return {
    processed,
    resolved,
    failed,
  };
}

/**
 * Directory-level reconciliation sweeper:
 * Audits uploads directory to remove stranded files unreferenced by any property.
 * Mitigates untracked orphans in case of database persistence outages or abandoned uploads.
 * Uses a configurable minimum-age grace period (default 1 hour) to protect in-progress uploads.
 */
export async function reconcileDiskOrphans(
  knownReferencedFiles?: Set<string>,
  maxAgeMs = 60 * 60 * 1000
): Promise<{ audited: number; purged: number; removed: number; skippedActive: number; skippedRecent: number }> {
  let audited = 0;
  let purged = 0;
  let skippedActive = 0;
  let skippedRecent = 0;

  if (!fs.existsSync(uploadsDir)) {
    return { audited: 0, purged: 0, removed: 0, skippedActive: 0, skippedRecent: 0 };
  }

  let referencedSet = knownReferencedFiles;
  if (!referencedSet) {
    referencedSet = new Set<string>();
    try {
      const properties = await Property.find({}, { images: 1 }).lean();
      for (const prop of properties) {
        if (Array.isArray(prop.images)) {
          for (const img of prop.images) {
            if (img?.url) referencedSet.add(img.url);
            if (img?.fileId) referencedSet.add(img.fileId);
          }
        }
      }
      const appointments = await Appointment.find({}, { propertyThumbnail: 1 }).lean();
      for (const appt of appointments) {
        if (appt.propertyThumbnail) {
          referencedSet.add(appt.propertyThumbnail);
        }
      }
    } catch (err: any) {
      console.warn('[ImageService] Failed to query active references for disk reconciliation:', err.message);
    }
  }

  const normalizedUploadsDir = path.resolve(uploadsDir);
  const files = await fs.promises.readdir(uploadsDir);

  for (const filename of files) {
    if (filename.startsWith('.')) continue;

    // Strict path validation: ensure target file strictly resides inside uploadsDir
    const resolvedPath = path.resolve(uploadsDir, filename);
    if (!resolvedPath.startsWith(normalizedUploadsDir + path.sep)) {
      continue;
    }

    audited++;

    // Check if filename or url (/uploads/filename) is referenced by any active property or appointment
    if (referencedSet.has(filename) || referencedSet.has(`/uploads/${filename}`)) {
      skippedActive++;
      continue;
    }

    try {
      const stats = await fs.promises.stat(resolvedPath);
      // Only purge if file age exceeds minimum-age grace period (protects in-progress form fills)
      if (maxAgeMs <= 0 || Date.now() - stats.mtimeMs >= maxAgeMs) {
        await fs.promises.unlink(resolvedPath);
        purged++;
      } else {
        skippedRecent++;
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn(`[ImageService] Failed to sweep untracked disk file ${filename}:`, err.message);
      }
    }
  }

  return { audited, purged, removed: purged, skippedActive, skippedRecent };
}
