import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import {
  setImageKitClientForTesting,
  getImageKitClient,
  isDurableStorageConfigured,
  processAndUploadImage,
} from '../src/services/imageService';
import { env } from '../src/config/env';

const app = createApp();

describe('SEC-01 & STORAGE-01: Multer Security & Production Durable Storage', () => {
  let authToken: string;
  let validPngBuffer: Buffer;

  beforeEach(async () => {
    // Generate valid 100x100 PNG
    validPngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 120, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Register user
    const res = await request(app).post('/api/auth/register').send({
      name: 'Storage Tester',
      email: 'storage.tester@sapphireiq.local',
      password: 'Password123!',
    });
    authToken = res.body.token;
  });

  afterEach(() => {
    // Reset any test overrides
    setImageKitClientForTesting(null);
    process.env.NODE_ENV = 'test';
  });

  describe('SEC-01: Multer Multipart Security Limits', () => {
    it('rejects uploads with unexpected field names with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('wrong_field_name', validPngBuffer, 'valid.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Unexpected upload field|No image files uploaded/);
    });

    it('rejects uploads with more than 4 images with HTTP 400', async () => {
      const req = request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${authToken}`);

      for (let i = 1; i <= 5; i++) {
        req.attach('images', validPngBuffer, `test_${i}.png`);
      }

      const res = await req;
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Maximum of 4 images allowed');
    });

    it('rejects uploads with too many multipart non-file fields', async () => {
      const req = request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', validPngBuffer, 'test.png');

      // Add 15 extra non-file fields (limit is 10)
      for (let i = 0; i < 15; i++) {
        req.field(`field_${i}`, `value_${i}`);
      }

      const res = await req;
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Too many form fields/i);
    });
  });

  describe('STORAGE-01: Fail-Closed Durable Cloud Storage in Production', () => {
    it('fails closed with HTTP 503 in production if ImageKit is not configured', async () => {
      process.env.NODE_ENV = 'production';
      setImageKitClientForTesting(null);

      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', validPngBuffer, 'apartment.png');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Permanent cloud storage (ImageKit) is not configured');
    });

    it('fails closed with HTTP 503 in production if ImageKit upload fails after retries', async () => {
      process.env.NODE_ENV = 'production';

      // Mock ImageKit client that fails upload
      const mockImageKit: any = {
        files: {
          upload: vi.fn().mockRejectedValue(new Error('ImageKit API connection timed out')),
          delete: vi.fn(),
        },
      };
      setImageKitClientForTesting(mockImageKit);

      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', validPngBuffer, 'apartment.png');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Durable cloud image storage upload failed');
      expect(mockImageKit.files.upload).toHaveBeenCalledTimes(2); // Retried twice
    });

    it('successfully uploads to ImageKit and returns remote URL when configured in production', async () => {
      process.env.NODE_ENV = 'production';

      const mockImageKit: any = {
        files: {
          upload: vi.fn().mockResolvedValue({
            url: 'https://ik.imagekit.io/sapphireiq/properties/test_remote_img.webp',
            fileId: 'ik_file_123456',
          }),
          delete: vi.fn(),
        },
      };
      setImageKitClientForTesting(mockImageKit);

      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', validPngBuffer, 'apartment.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].url).toBe('https://ik.imagekit.io/sapphireiq/properties/test_remote_img.webp');
      expect(res.body.data[0].fileId).toBe('ik_file_123456');
    });

    it('allows local disk storage in development and test environments', async () => {
      process.env.NODE_ENV = 'test';
      setImageKitClientForTesting(null);

      const res = await request(app)
        .post('/api/properties/upload-images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', validPngBuffer, 'apartment.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].url).toMatch(/^\/uploads\//);
    });
  });
});
