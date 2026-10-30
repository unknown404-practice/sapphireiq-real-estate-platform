import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('NET-01: Express Trust Proxy & Upstream Header Resolution', () => {
  it('has trust proxy explicitly configured to 1 for Render edge reverse proxy', () => {
    const app = createApp();
    expect(app.get('trust proxy')).toBe(1);
  });

  it('correctly resolves client IP from X-Forwarded-For single-hop reverse proxy', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/api/health')
      .set('X-Forwarded-For', '203.0.113.195');

    expect(res.status).toBe(200);
    expect(res.headers['x-client-ip']).toBe('203.0.113.195');
  });

  it('correctly extracts client IP when multiple proxies are chained in X-Forwarded-For', async () => {
    const app = createApp();

    // Client -> Proxy1 -> Render (1 hop)
    // With trust proxy: 1, Express trusts only 1 hop from the right
    const res = await request(app)
      .get('/api/health')
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.50');

    expect(res.status).toBe(200);
    expect(res.headers['x-client-ip']).toBe('203.0.113.50');
  });
});
