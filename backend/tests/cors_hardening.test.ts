import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('SEC-03: CORS Production Hardening', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Non-Production Environments (Development / Test)', () => {
    it('allows requests from localhost:5173 in development', async () => {
      process.env.NODE_ENV = 'development';
      const app = createApp();

      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('allows requests from 127.0.0.1:5173 in development', async () => {
      process.env.NODE_ENV = 'development';
      const app = createApp();

      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://127.0.0.1:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    });
  });

  describe('Production Environment', () => {
    it('strictly rejects localhost:5173 in production when not configured in APP_ORIGIN', async () => {
      process.env.NODE_ENV = 'production';
      const app = createApp();

      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects attacker-crafted subdomain on vercel.app', async () => {
      process.env.NODE_ENV = 'production';
      const app = createApp();

      // Attacker trying to exploit prefix matching
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'https://sapphireiq-attacker.vercel.app')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects arbitrary external origins in production', async () => {
      process.env.NODE_ENV = 'production';
      const app = createApp();

      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'https://malicious-phishing-site.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('accepts legitimate Vercel preview deployment for the exact project', async () => {
      process.env.NODE_ENV = 'production';
      const app = createApp();

      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'https://sapphireiq-real-estate-platform-preview-12345.vercel.app')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBe(
        'https://sapphireiq-real-estate-platform-preview-12345.vercel.app'
      );
    });

    it('allows requests with no Origin header (curl, mobile, server-to-server)', async () => {
      process.env.NODE_ENV = 'production';
      const app = createApp();

      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    });
  });
});
