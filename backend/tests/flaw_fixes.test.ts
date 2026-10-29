import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { Property } from '../src/models/Property';
import { Appointment } from '../src/models/Appointment';
import { User } from '../src/models/User';
import { OrphanedUpload } from '../src/models/OrphanedUpload';
import { retryOrphanedUploadCleanups, reconcileDiskOrphans } from '../src/services/imageService';
import { env } from '../src/config/env';

const app = createApp();

describe('Flaw Fixes Integration Suite', () => {
  let userAToken: string;
  let userBToken: string;
  let adminToken: string;
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    // User A (Seller / Owner)
    const resA = await request(app).post('/api/auth/register').send({
      name: 'Seller Alice',
      email: 'alice.flaws@example.com',
      password: 'Password123!',
    });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // User B (Buyer / Viewer)
    const resB = await request(app).post('/api/auth/register').send({
      name: 'Buyer Bob',
      email: 'bob.flaws@example.com',
      password: 'Password123!',
    });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    // Admin User
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin.flaws@example.com',
      password: 'Password123!',
      role: 'admin',
    });
    adminToken = jwt.sign(
      { id: adminUser._id.toString(), email: adminUser.email, role: 'admin' },
      env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Finding-01: Input Type Robustness (typeof guards)', () => {
    it('returns 400 when non-string types are supplied to auth registration', async () => {
      // name is a number
      const res1 = await request(app).post('/api/auth/register').send({
        name: 12345,
        email: 'valid@example.com',
        password: 'Password123!',
      });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      // email is an object (NoSQL injection attempt or malformed payload)
      const res2 = await request(app).post('/api/auth/register').send({
        name: 'Valid Name',
        email: { $gt: '' },
        password: 'Password123!',
      });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);

      // phone is an object
      const res3 = await request(app).post('/api/auth/register').send({
        name: 'Valid Name',
        email: 'newuser@example.com',
        password: 'Password123!',
        phone: { malicious: true },
      });
      expect(res3.status).toBe(400);
      expect(res3.body.success).toBe(false);
    });

    it('returns 400 when non-string types are supplied to auth login', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: { $gt: '' },
        password: 12345,
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('strings');
    });

    it('returns 400 when non-string email is supplied to forgot-password', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 12345,
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when non-string token or password is supplied to reset-password', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: { id: 1 },
        password: 123456,
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when non-string types are supplied to property creation', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 12345,
          description: 'Valid description text',
          city: 'Mumbai',
          state: 'Maharashtra',
          price: 5000000,
          propertyType: 'apartment',
          listingType: 'sale',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when non-string types are supplied to property updates', async () => {
      // Create valid property first
      const createRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Initial Property Title',
          description: 'Valid description text',
          city: 'Mumbai',
          state: 'Maharashtra',
          price: 5000000,
          propertyType: 'apartment',
          listingType: 'sale',
        });
      const propId = createRes.body.data._id;

      const patchRes = await request(app)
        .patch(`/api/properties/${propId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 99999,
        });
      expect(patchRes.status).toBe(400);
      expect(patchRes.body.success).toBe(false);
    });

    it('returns 400 when non-string types are supplied to appointment endpoints', async () => {
      const createRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Viewing Property',
          description: 'Available for visits',
          city: 'Delhi',
          state: 'Delhi',
          price: 7500000,
          propertyType: 'apartment',
          listingType: 'sale',
        });
      const propId = createRes.body.data._id;

      // Guest appointment with non-string guestEmail
      const guestRes = await request(app)
        .post('/api/appointments/guest')
        .send({
          property: propId,
          guestName: 'Guest John',
          guestEmail: { injection: true },
          guestPhone: '+91 9999999999',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(guestRes.status).toBe(400);
      expect(guestRes.body.success).toBe(false);

      // Authenticated appointment with non-string phone
      const authApptRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          property: propId,
          phone: 987654321,
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(authApptRes.status).toBe(400);
      expect(authApptRes.body.success).toBe(false);

      // Non-string scheduledAt
      const invalidDateRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          property: propId,
          scheduledAt: 1234567890,
        });
      expect(invalidDateRes.status).toBe(400);
      expect(invalidDateRes.body.success).toBe(false);
    });

    it('returns 400 when req.body is null or non-object', async () => {
      const resRegister = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('null');
      expect(resRegister.status).toBe(400);
      expect(resRegister.body.success).toBe(false);

      const resLogin = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('null');
      expect(resLogin.status).toBe(400);
      expect(resLogin.body.success).toBe(false);

      const resCreateProp = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .set('Content-Type', 'application/json')
        .send('null');
      expect(resCreateProp.status).toBe(400);
      expect(resCreateProp.body.success).toBe(false);
    });

    it('returns 400 when non-string query parameters are passed to GET /api/properties', async () => {
      const resCity = await request(app).get('/api/properties?city[$gt]=');
      expect(resCity.status).toBe(400);
      expect(resCity.body.success).toBe(false);
      expect(resCity.body.error).toContain('City');

      const resSearch = await request(app).get('/api/properties?search[$gt]=');
      expect(resSearch.status).toBe(400);
      expect(resSearch.body.success).toBe(false);
      expect(resSearch.body.error).toContain('Search');

      const resType = await request(app).get('/api/properties?propertyType[$gt]=');
      expect(resType.status).toBe(400);
      expect(resType.body.success).toBe(false);
      expect(resType.body.error).toContain('Property type');
    });

    it('returns 400 when invalid amenities or images are provided on property create/update', async () => {
      // amenities as object
      const res1 = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Luxury Penthouse',
          description: 'Top floor with skyline views',
          city: 'Mumbai',
          state: 'Maharashtra',
          price: 25000000,
          propertyType: 'apartment',
          listingType: 'sale',
          amenities: { pool: true },
        });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      // images as string
      const res2 = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Luxury Penthouse',
          description: 'Top floor with skyline views',
          city: 'Mumbai',
          state: 'Maharashtra',
          price: 25000000,
          propertyType: 'apartment',
          listingType: 'sale',
          images: 'not-an-array',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });
  });

  describe('Finding-02: Multer File Filter & Image Content Signature Validation', () => {
    // 1x1 valid minimal JPEG
    const valid1x1Jpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9,
    ]);

    // 1x1 valid minimal PNG
    const valid1x1Png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    // 1x1 valid minimal WebP
    const valid1x1Webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c, 0x0e, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00,
      0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0x00,
    ]);

    it('returns HTTP 400 instead of 500 when disallowed MIME type is uploaded', async () => {
      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', Buffer.from('<html><body>Payload</body></html>'), {
          filename: 'payload.html',
          contentType: 'text/html',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid file type');
    });

    it('accepts valid image upload with uppercase MIME type like image/JPEG', async () => {
      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Jpg, {
          filename: 'photo.JPEG',
          contentType: 'image/JPEG',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].url).toContain('.jpg');
    });

    it('rejects harmless HTML text disguised as image/jpeg and does not persist it to disk', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const countBefore = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0;

      const htmlPayload = Buffer.from('<!DOCTYPE html><html><body><h1>XSS Proof</h1></body></html>');
      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', htmlPayload, {
          filename: 'exploit.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid file signature');

      const countAfter = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0;
      expect(countAfter).toBe(countBefore);
    });

    it('rejects corrupt or truncated image with HTTP 400', async () => {
      const truncated = Buffer.from([0x00, 0x01]);
      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', truncated, {
          filename: 'truncated.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('File is too small');
    });

    it('rejects MIME mismatch when file signature does not match declared Content-Type', async () => {
      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Png, {
          filename: 'mismatch.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('MIME type mismatch');
    });

    it('accepts genuine PNG and WebP images with matching signatures', async () => {
      const resPng = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Png, { filename: 'sample.png', contentType: 'image/png' });
      expect(resPng.status).toBe(200);
      expect(resPng.body.data[0].url).toContain('.png');

      const resWebp = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Webp, { filename: 'sample.webp', contentType: 'image/webp' });
      expect(resWebp.status).toBe(200);
      expect(resWebp.body.data[0].url).toContain('.webp');
    });

    it('rejects valid image signature followed by corrupted/incomplete raster stream', async () => {
      // Starts with JPEG SOI and JFIF header, but truncated/garbled stream
      const corruptJpegStream = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef,
      ]);
      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', corruptJpegStream, {
          filename: 'corrupted_stream.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Corrupted image|Failed to parse|unable to decode/i);
    });

    it('rejects images exceeding maximum allowed dimensions (decompression bomb protection)', async () => {
      // Generate image with width 4097px (exceeds MAX_IMAGE_DIMENSION = 4096)
      const oversizedBuffer = await sharp({
        create: {
          width: 4097,
          height: 10,
          channels: 3,
          background: { r: 20, g: 30, b: 40 },
        },
      })
        .png()
        .toBuffer();

      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', oversizedBuffer, {
          filename: 'oversized_bomb.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('exceed maximum allowed limit');
    });

    it('enforces atomic uploads: mixed valid and invalid batch leaves zero files behind', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const countBefore = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0;

      // File 1 is valid PNG, File 2 is corrupt JPEG
      const corruptJpegStream = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Png, { filename: 'valid.png', contentType: 'image/png' })
        .attach('images', corruptJpegStream, { filename: 'corrupt.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      // Verify atomic property: no files from the batch were written to disk
      const countAfter = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0;
      expect(countAfter).toBe(countBefore);
    });

    it('simulates a mid-batch storage failure and verifies that previously written files are rolled back and removed', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const countBefore = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0;

      // Two valid images that both pass in-memory pre-validation
      const realWriteFile = fs.promises.writeFile;
      let writeCount = 0;
      let writtenFilePath = '';

      const spy = vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filepath, data, options) => {
        writeCount++;
        if (writeCount === 1) {
          writtenFilePath = filepath as string;
          return realWriteFile.call(fs.promises, filepath, data, options);
        } else {
          throw new Error('Simulated mid-stream disk write failure');
        }
      });

      try {
        const res = await request(app)
          .post('/api/properties/upload-images')
          .set('Authorization', `Bearer ${userAToken}`)
          .attach('images', valid1x1Png, { filename: 'image1.png', contentType: 'image/png' })
          .attach('images', valid1x1Jpg, { filename: 'image2.jpg', contentType: 'image/jpeg' });

        // Storage failure propagates as 500 error from storage driver
        expect(res.status).toBe(500);
        expect(writeCount).toBe(2);

        // Verify rollback: File 1 was initially written, but catch block invoked deleteImage()
        expect(writtenFilePath).toBeTruthy();
        expect(fs.existsSync(writtenFilePath)).toBe(false);

        const countAfter = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0;
        expect(countAfter).toBe(countBefore);
      } finally {
        spy.mockRestore();
      }
    });

    it('simulates a failure during rollback cleanup, safely logs the failure without exposing secrets, and surfaces an unresolved cleanup failure', async () => {
      const realWriteFile = fs.promises.writeFile;
      let writeCount = 0;
      let writtenFilePath = '';

      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filepath, data, options) => {
        writeCount++;
        if (writeCount === 1) {
          writtenFilePath = filepath as string;
          return realWriteFile.call(fs.promises, filepath, data, options);
        } else {
          throw new Error('Simulated mid-stream storage failure');
        }
      });

      // Simulate failure in the cleanup operation itself (e.g. EPERM / disk lock during unlink)
      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('EPERM: operation not permitted'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const res = await request(app)
          .post('/api/properties/upload-images')
          .set('Authorization', `Bearer ${userAToken}`)
          .attach('images', valid1x1Png, { filename: 'image1.png', contentType: 'image/png' })
          .attach('images', valid1x1Jpg, { filename: 'image2.jpg', contentType: 'image/jpeg' });

        // HTTP response must surface that cleanup rollback failed and orphan was tracked
        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('cleanup rollback failed for 1 file(s)');
        expect(res.body.error).toContain('Orphaned file(s) tracked for automated recovery');

        // Verify storage inspection: file was NOT falsely claimed to be deleted
        expect(writtenFilePath).toBeTruthy();
        expect(fs.existsSync(writtenFilePath)).toBe(true);

        const safeFilename = path.basename(writtenFilePath);

        // Verify database isolation: file is NOT referenced by any property
        const referencedProp = await Property.findOne({ 'images.url': { $regex: safeFilename } });
        expect(referencedProp).toBeNull();

        // Verify recovery tracking: orphan is actively tracked in database
        const orphanRecord = await OrphanedUpload.findOne({ fileId: safeFilename });
        expect(orphanRecord).not.toBeNull();
        expect(orphanRecord?.status).toBe('pending');
        expect(orphanRecord?.errorReason).toContain('EPERM');

        // Verify safe logging without leaking secrets or credentials
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedText = consoleErrorSpy.mock.calls.map(c => c.join(' ')).join(' ');
        expect(loggedText).toContain('CRITICAL: Multi-image rollback failed to clean up all files safely');
        expect(loggedText).not.toContain('IMAGEKIT_PRIVATE_KEY');
        expect(loggedText).not.toContain('JWT_SECRET');
        expect(loggedText).not.toContain('Bearer');

        // Now test the automated recovery reconciliation mechanism once lock/EPERM is cleared
        unlinkSpy.mockRestore(); // Restore real unlink
        const reconResult = await retryOrphanedUploadCleanups();
        expect(reconResult.resolved).toBeGreaterThanOrEqual(1);

        // Physical storage re-inspection: file is now verified removed from disk
        expect(fs.existsSync(writtenFilePath)).toBe(false);

        // Database status re-inspection: record transitioned to 'resolved'
        const resolvedRecord = await OrphanedUpload.findOne({ fileId: safeFilename });
        expect(resolvedRecord?.status).toBe('resolved');
      } finally {
        writeSpy.mockRestore();
        unlinkSpy.mockRestore();
        consoleErrorSpy.mockRestore();

        // Isolated cleanup safety net
        if (writtenFilePath && fs.existsSync(writtenFilePath)) {
          fs.unlinkSync(writtenFilePath);
        }
      }
    });

    it('enforces admin authorization on POST /api/properties/reconcile-orphans and rejects arbitrary client execution', async () => {
      // 1. Unauthenticated request -> 401
      const resUnauth = await request(app).post('/api/properties/reconcile-orphans');
      expect(resUnauth.status).toBe(401);

      // 2. Normal user request (non-admin) -> 403 Forbidden
      const resUser = await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resUser.status).toBe(403);
      expect(resUser.body.error).toContain('Admin access required');

      // 3. Admin user request -> 200 OK
      const resAdmin = await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);
      expect(resAdmin.body.data).toHaveProperty('processed');
    });

    it('validates storage identifiers and blocks path traversal attempts during recovery', async () => {
      // Malicious orphan record attempting directory traversal
      const maliciousOrphan = await OrphanedUpload.create({
        fileId: '../../etc/passwd',
        url: '/uploads/../../etc/passwd',
        errorReason: 'Malicious injection test',
        status: 'pending',
      });

      const res = await retryOrphanedUploadCleanups();
      expect(res.failed).toBeGreaterThanOrEqual(1);

      const reloaded = await OrphanedUpload.findById(maliciousOrphan._id);
      expect(reloaded?.status).toBe('failed');
      expect(reloaded?.errorReason).toMatch(/traversal|Invalid/i);
    });

    it('guarantees idempotency and safe repeat execution of the recovery worker', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const testFilename = `idempotent-${Date.now()}.png`;
      const testFilepath = path.join(uploadsDir, testFilename);

      await fs.promises.writeFile(testFilepath, valid1x1Png);
      expect(fs.existsSync(testFilepath)).toBe(true);

      const record = await OrphanedUpload.create({
        fileId: testFilename,
        url: `/uploads/${testFilename}`,
        errorReason: 'Idempotency test',
        status: 'pending',
      });

      // Run 1: Should resolve and delete the file
      const run1 = await retryOrphanedUploadCleanups();
      expect(run1.resolved).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(testFilepath)).toBe(false);

      const recordAfterRun1 = await OrphanedUpload.findById(record._id);
      expect(recordAfterRun1?.status).toBe('resolved');

      // Run 2: Repeat execution should be a no-op (idempotent)
      const run2 = await retryOrphanedUploadCleanups();
      expect(run2.resolved).toBe(0);
      expect(run2.processed).toBe(0);

      // Verify resolved record is untouched
      const recordAfterRun2 = await OrphanedUpload.findById(record._id);
      expect(recordAfterRun2?.status).toBe('resolved');
    });

    it('protects concurrent worker executions from race conditions using atomic claiming', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const fileA = `concurrent-A-${Date.now()}.png`;
      const fileB = `concurrent-B-${Date.now()}.png`;
      const pathA = path.join(uploadsDir, fileA);
      const pathB = path.join(uploadsDir, fileB);

      await fs.promises.writeFile(pathA, valid1x1Png);
      await fs.promises.writeFile(pathB, valid1x1Png);

      const recA = await OrphanedUpload.create({
        fileId: fileA,
        url: `/uploads/${fileA}`,
        errorReason: 'Concurrency test A',
        status: 'pending',
      });
      const recB = await OrphanedUpload.create({
        fileId: fileB,
        url: `/uploads/${fileB}`,
        errorReason: 'Concurrency test B',
        status: 'pending',
      });

      // Run two workers simultaneously
      const [worker1, worker2] = await Promise.all([
        retryOrphanedUploadCleanups(),
        retryOrphanedUploadCleanups(),
      ]);

      // Total resolved across both workers must equal 2 without collision
      expect(worker1.resolved + worker2.resolved).toBe(2);
      expect(fs.existsSync(pathA)).toBe(false);
      expect(fs.existsSync(pathB)).toBe(false);

      const finalA = await OrphanedUpload.findById(recA._id);
      const finalB = await OrphanedUpload.findById(recB._id);
      expect(finalA?.status).toBe('resolved');
      expect(finalB?.status).toBe('resolved');
    });

    it('detects and flags tracking persistence failure when database write fails during rollback', async () => {
      const realWriteFile = fs.promises.writeFile;
      let writtenFilePath = '';

      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filepath, data, options) => {
        if (!writtenFilePath) {
          writtenFilePath = filepath as string;
          return realWriteFile.call(fs.promises, filepath, data, options);
        } else {
          throw new Error('Simulated storage error on file 2');
        }
      });

      // Simulate unlink failure on file 1
      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('EPERM simulated'));
      // AND simulate database write failure when attempting to track the orphan
      const dbSpy = vi.spyOn(OrphanedUpload, 'create').mockRejectedValue(new Error('Mongo connection failure'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const res = await request(app)
          .post('/api/properties/upload-images')
          .set('Authorization', `Bearer ${userAToken}`)
          .attach('images', valid1x1Png, { filename: 'image1.png', contentType: 'image/png' })
          .attach('images', valid1x1Jpg, { filename: 'image2.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        // Explicitly discloses that tracking persistence failed and filesystem reconciliation is required
        expect(res.body.error).toContain('tracking persistence failed');
        expect(res.body.error).toContain('Manual filesystem reconciliation required');

        // File remains on disk as untracked orphan
        expect(fs.existsSync(writtenFilePath)).toBe(true);
      } finally {
        writeSpy.mockRestore();
        unlinkSpy.mockRestore();
        dbSpy.mockRestore();
        consoleErrorSpy.mockRestore();

        if (writtenFilePath && fs.existsSync(writtenFilePath)) {
          fs.unlinkSync(writtenFilePath);
        }
      }
    });

    it('recovers untracked disk orphans using directory-level sweeper', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const untrackedFile = `untracked-disk-${Date.now()}.png`;
      const untrackedPath = path.join(uploadsDir, untrackedFile);

      await fs.promises.writeFile(untrackedPath, valid1x1Png);
      expect(fs.existsSync(untrackedPath)).toBe(true);

      // Known referenced files from active properties (untrackedFile is not in this set)
      const activeProperties = new Set<string>(['seeded-property.jpg']);

      // Sweep with maxAgeMs = 0 (immediate purge of unreferenced files)
      const sweepResult = await reconcileDiskOrphans(activeProperties, 0);
      expect(sweepResult.purged).toBeGreaterThanOrEqual(1);

      // Verify physical disk deletion
      expect(fs.existsSync(untrackedPath)).toBe(false);
    });

    it('TEST 1: protects freshly uploaded images before property save when reconciliation runs', async () => {
      const uploadRes = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Png, { filename: 'upload-before-save.png', contentType: 'image/png' });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.success).toBe(true);
      const uploadedUrl = uploadRes.body.data[0].url;
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const filename = path.basename(uploadedUrl);
      const filePath = path.join(uploadsDir, filename);

      // 2. Verify file exists on disk
      expect(fs.existsSync(filePath)).toBe(true);

      // 3. Do not create property yet. Run reconciliation via admin endpoint
      const reconRes = await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reconRes.status).toBe(200);

      // 4. Verify file still exists on disk (not purged while legitimately in progress)
      expect(fs.existsSync(filePath)).toBe(true);

      // Cleanup
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    it('TEST 2: preserves uploaded images during slow form submission and serves them after property creation', async () => {
      // 1. Upload images
      const uploadRes = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Png, { filename: 'slow-form.png', contentType: 'image/png' });
      expect(uploadRes.status).toBe(200);
      const uploadedImage = uploadRes.body.data[0];
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const filename = path.basename(uploadedImage.url);
      const filePath = path.join(uploadsDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      // 2. Simulate delay & run multiple reconciliation runs during the delay
      await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${adminToken}`);

      // File must still exist
      expect(fs.existsSync(filePath)).toBe(true);

      // 3. Now user finishes filling the form and creates the property
      const propRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Slow Form Property Test',
          description: 'A luxurious property submitted after delayed form completion.',
          price: 15000000,
          propertyType: 'apartment',
          listingType: 'sale',
          bedrooms: 3,
          bathrooms: 2,
          area: 1800,
          city: 'Hyderabad',
          state: 'Telangana',
          address: '100 Cyber City Way',
          images: [uploadedImage],
        });

      expect(propRes.status).toBe(201);
      expect(propRes.body.success).toBe(true);
      expect(propRes.body.data.images[0].url).toBe(uploadedImage.url);

      // 4. Run reconciliation again now that property is saved
      await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${adminToken}`);

      // Image remains intact and accessible
      expect(fs.existsSync(filePath)).toBe(true);

      // Clean up property and file
      await Property.findByIdAndDelete(propRes.body.data._id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    it('TEST 3: cleans up genuinely abandoned uploads after grace period while keeping active uploads safe', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      // 1. Create an active property with a referenced image
      const activeFilename = `active-${Date.now()}.png`;
      const activePath = path.join(uploadsDir, activeFilename);
      await fs.promises.writeFile(activePath, valid1x1Png);

      const activeProp = await Property.create({
        title: 'Active Listed Property',
        description: 'Active listing with valid image references.',
        price: 20000000,
        propertyType: 'villa',
        listingType: 'sale',
        bedrooms: 4,
        bathrooms: 4,
        area: 3200,
        city: 'Hyderabad',
        state: 'Telangana',
        address: '42 Jubliee Hills',
        images: [{ url: `/uploads/${activeFilename}`, key: activeFilename }],
        owner: userAId,
      });

      // 2. Upload an image and deliberately abandon the form (no property created)
      const abandonedFilename = `abandoned-${Date.now()}.png`;
      const abandonedPath = path.join(uploadsDir, abandonedFilename);
      await fs.promises.writeFile(abandonedPath, valid1x1Png);

      // 3. Immediately run sweeper: both files remain because abandoned file is within grace period
      await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fs.existsSync(activePath)).toBe(true);
      expect(fs.existsSync(abandonedPath)).toBe(true);

      // 4. Now simulate passage of grace period by setting mtime of abandoned file to 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await fs.promises.utimes(abandonedPath, twoHoursAgo, twoHoursAgo);

      // 5. Run sweeper with standard 1-hour grace period
      await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${adminToken}`);

      // Abandoned file is purged, active file remains intact
      expect(fs.existsSync(abandonedPath)).toBe(false);
      expect(fs.existsSync(activePath)).toBe(true);

      // Clean up active
      await Property.findByIdAndDelete(activeProp._id);
      if (fs.existsSync(activePath)) {
        fs.unlinkSync(activePath);
      }
    });

    it('TEST 4: preserves images after property-save failure so user can recover and resubmit', async () => {
      // 1. Upload valid image
      const uploadRes = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('images', valid1x1Png, { filename: 'fail-recover.png', contentType: 'image/png' });
      expect(uploadRes.status).toBe(200);
      const uploadedImage = uploadRes.body.data[0];
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const filename = path.basename(uploadedImage.url);
      const filePath = path.join(uploadsDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      // 2. Simulate property creation failure (e.g. negative price or missing title)
      const failedRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: '', // Invalid empty title
          price: -500, // Invalid negative price
          propertyType: 'apartment',
          listingType: 'sale',
          city: 'Hyderabad',
          state: 'Telangana',
          address: '77 Street',
          images: [uploadedImage],
        });
      expect(failedRes.status).toBe(400);

      // 3. Run reconciliation: image is preserved, allowing the client to recover
      await request(app)
        .post('/api/properties/reconcile-orphans')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fs.existsSync(filePath)).toBe(true);

      // 4. User corrects the form and successfully saves property
      const successRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Recovered Property Listing',
          description: 'Successfully saved after initial validation correction.',
          price: 12000000,
          propertyType: 'apartment',
          listingType: 'sale',
          bedrooms: 2,
          bathrooms: 2,
          area: 1250,
          city: 'Hyderabad',
          state: 'Telangana',
          address: '77 Gachibowli High Street',
          images: [uploadedImage],
        });
      expect(successRes.status).toBe(201);
      expect(fs.existsSync(filePath)).toBe(true);

      // Clean up
      await Property.findByIdAndDelete(successRes.body.data._id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    it('guarantees concurrent sweeper safety and restricts unlinks strictly to uploads directory', async () => {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const file1 = `concurrent-sweep-1-${Date.now()}.png`;
      const file2 = `concurrent-sweep-2-${Date.now()}.png`;
      const path1 = path.join(uploadsDir, file1);
      const path2 = path.join(uploadsDir, file2);

      await fs.promises.writeFile(path1, valid1x1Png);
      await fs.promises.writeFile(path2, valid1x1Png);

      // Run sweeper concurrently across two calls
      const activeSet = new Set<string>(); // neither file is referenced
      const [res1, res2] = await Promise.all([
        reconcileDiskOrphans(activeSet, 0),
        reconcileDiskOrphans(activeSet, 0),
      ]);

      // Both files purged without ENOENT crash
      expect(res1.purged + res2.purged).toBeGreaterThanOrEqual(2);
      expect(fs.existsSync(path1)).toBe(false);
      expect(fs.existsSync(path2)).toBe(false);
    });
  });

  describe('Finding-03: Preserved Historical Appointment References on Property Deletion', () => {
    it('denormalizes property snapshot fields and retains appointment context after deletion', async () => {
      // 1. User A creates property
      const propRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Historic Villa in Goa',
          description: 'Seaside villa with private pool',
          city: 'Panaji',
          state: 'Goa',
          price: 18000000,
          propertyType: 'villa',
          listingType: 'sale',
          images: [{ url: '/uploads/sample-goa.jpg', caption: 'Villa Front' }],
        });
      expect(propRes.status).toBe(201);
      const propertyId = propRes.body.data._id;

      // 2. User B books viewing
      const futureDate = new Date(Date.now() + 2 * 86400000).toISOString();
      const apptRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          property: propertyId,
          scheduledAt: futureDate,
          notes: 'Looking forward to the tour',
        });
      expect(apptRes.status).toBe(201);
      const apptId = apptRes.body.data._id;

      // Check Appointment in DB has denormalized snapshot fields
      const savedAppt = await Appointment.findById(apptId);
      expect(savedAppt).not.toBeNull();
      expect(savedAppt?.propertyTitle).toBe('Historic Villa in Goa');
      expect(savedAppt?.propertyCity).toBe('Panaji');
      expect(savedAppt?.propertyPrice).toBe(18000000);
      expect(savedAppt?.propertyThumbnail).toBe('/uploads/sample-goa.jpg');
      expect(savedAppt?.propertyOwner?.toString()).toBe(userAId);

      // 3. User A deletes the property
      const delRes = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(delRes.status).toBe(200);

      // Verify property is deleted
      const checkProp = await Property.findById(propertyId);
      expect(checkProp).toBeNull();

      // 4. Verify User B (buyer) can still view appointment in dashboard with property context
      const buyerApptsRes = await request(app)
        .get('/api/appointments/mine')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(buyerApptsRes.status).toBe(200);
      expect(buyerApptsRes.body.data.length).toBeGreaterThanOrEqual(1);

      const buyerAppt = buyerApptsRes.body.data.find((a: any) => a._id === apptId);
      expect(buyerAppt).toBeDefined();
      expect(buyerAppt.status).toBe('cancelled'); // Cancelled on deletion
      expect(buyerAppt.propertyTitle).toBe('Historic Villa in Goa');
      expect(buyerAppt.propertyCity).toBe('Panaji');
      expect(buyerAppt.propertyPrice).toBe(18000000);

      // 5. Verify User A (seller) STILL sees the appointment history under /mine
      const sellerApptsRes = await request(app)
        .get('/api/appointments/mine')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(sellerApptsRes.status).toBe(200);

      const sellerAppt = sellerApptsRes.body.data.find((a: any) => a._id === apptId);
      expect(sellerAppt).toBeDefined();
      expect(sellerAppt.propertyTitle).toBe('Historic Villa in Goa');
    });

    it('preserves all 4 appointment states (pending, confirmed, cancelled, completed) across property deletion', async () => {
      // 1. User A creates property
      const propRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Estate Across All 4 States',
          description: 'Testing full lifecycle integrity across all 4 states',
          city: 'Pune',
          state: 'Maharashtra',
          price: 15000000,
          propertyType: 'villa',
          listingType: 'sale',
          images: [{ url: '/uploads/estate.jpg', caption: 'Front' }],
        });
      expect(propRes.status).toBe(201);
      const propertyId = propRes.body.data._id;

      // 2. Provision Appointment 1: COMPLETED before deletion
      const resD = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          property: propertyId,
          scheduledAt: new Date(Date.now() + 10 * 86400000).toISOString(),
          notes: 'Completed tour notes',
        });
      const apptCompletedId = resD.body.data._id;
      await request(app)
        .patch(`/api/appointments/${apptCompletedId}/status`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'confirmed' });
      await request(app)
        .patch(`/api/appointments/${apptCompletedId}/status`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'completed' });

      // 3. Provision Appointment 2: CANCELLED before deletion (with buyer notes)
      const resC = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          property: propertyId,
          scheduledAt: new Date(Date.now() + 8 * 86400000).toISOString(),
          notes: 'User requested cancellation note',
        });
      const apptCancelledId = resC.body.data._id;
      await request(app)
        .patch(`/api/appointments/${apptCancelledId}/cancel`)
        .set('Authorization', `Bearer ${userBToken}`);

      // 4. Provision Appointment 3: CONFIRMED before deletion
      const resB = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          property: propertyId,
          scheduledAt: new Date(Date.now() + 6 * 86400000).toISOString(),
          notes: 'Confirmed tour notes',
        });
      const apptConfirmedId = resB.body.data._id;
      await request(app)
        .patch(`/api/appointments/${apptConfirmedId}/status`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'confirmed' });

      // 5. Provision Appointment 4: PENDING before deletion
      const resA = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          property: propertyId,
          scheduledAt: new Date(Date.now() + 4 * 86400000).toISOString(),
          notes: 'Pending tour notes',
        });
      const apptPendingId = resA.body.data._id;

      // 6. Delete Property
      const delRes = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(delRes.status).toBe(200);

      // 7. Verify all 4 appointments in /mine for Buyer
      const buyerRes = await request(app)
        .get('/api/appointments/mine')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(buyerRes.status).toBe(200);

      const apptPending = buyerRes.body.data.find((a: any) => a._id === apptPendingId);
      expect(apptPending.status).toBe('cancelled');
      expect(apptPending.notes).toBe('Property listing was removed by owner');
      expect(apptPending.propertyTitle).toBe('Estate Across All 4 States');

      const apptConfirmed = buyerRes.body.data.find((a: any) => a._id === apptConfirmedId);
      expect(apptConfirmed.status).toBe('confirmed');
      expect(apptConfirmed.notes).toBe('Confirmed tour notes');

      const apptCancelled = buyerRes.body.data.find((a: any) => a._id === apptCancelledId);
      expect(apptCancelled.status).toBe('cancelled');
      expect(apptCancelled.notes).toBe('User requested cancellation note');

      const apptCompleted = buyerRes.body.data.find((a: any) => a._id === apptCompletedId);
      expect(apptCompleted.status).toBe('completed');
      expect(apptCompleted.notes).toBe('Completed tour notes');
    });

    it('rejects malformed route parameters with HTTP 400 Bad Request', async () => {
      const resProp = await request(app).get('/api/properties/not-a-valid-object-id');
      expect(resProp.status).toBe(400);
      expect(resProp.body.error).toContain('Invalid property ID');

      const resApptStatus = await request(app)
        .patch('/api/appointments/not-a-valid-object-id/status')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'confirmed' });
      expect(resApptStatus.status).toBe(400);
      expect(resApptStatus.body.error).toContain('Invalid appointment ID');
    });
  });

  describe('Finding-04: CORS Disallowed Origin Handling', () => {
    it('returns clean response without 500 error when origin is disallowed', async () => {
      const res = await request(app)
        .get('/api/properties')
        .set('Origin', 'https://unauthorized-domain.com');

      // The request should succeed or be handled normally without a 500 error
      expect(res.status).not.toBe(500);
      expect(res.status).toBe(200);
      // Access-Control-Allow-Origin header must NOT be returned for unauthorized domain
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows permitted origin and sets CORS header', async () => {
      const res = await request(app)
        .get('/api/properties')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });
});
