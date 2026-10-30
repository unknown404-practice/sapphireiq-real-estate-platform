import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { env } from '../src/config/env';

const app = createApp();

describe('AUTH-01: Authentication & Session Security (Short-Lived JWT + Refresh Token Rotation)', () => {
  const testUser = {
    name: 'Session Security User',
    email: 'session.security@sapphireiq.local',
    password: 'Password123!',
  };

  beforeEach(async () => {
    // Fresh user registered for each test
    await request(app).post('/api/auth/register').send(testUser);
  });

  it('issues short-lived access token and sets HttpOnly refresh token cookie on register', async () => {
    const newUser = {
      name: 'Another User',
      email: 'another.user@sapphireiq.local',
      password: 'Password123!',
    };
    const res = await request(app).post('/api/auth/register').send(newUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    // Verify access token expiration is 15 minutes
    const decodedAccess: any = jwt.decode(res.body.token);
    expect(decodedAccess.exp - decodedAccess.iat).toBe(15 * 60);

    // Verify refresh token cookie is set with HttpOnly
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = Array.isArray(cookies) ? cookies.find((c) => c.startsWith('refreshToken=')) : cookies;
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/');
  });

  it('issues fresh access and refresh tokens on login', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = Array.isArray(cookies) ? cookies.find((c) => c.startsWith('refreshToken=')) : cookies;
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('rotates refresh token on POST /api/auth/refresh and returns new access token', async () => {
    // 1. Log in to get tokens
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });
    const originalRefreshToken = loginRes.body.refreshToken;
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // 2. Call /api/auth/refresh with cookie
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies!)
      .send();

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.token).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(originalRefreshToken);

    // 3. New access token works on protected endpoint
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(testUser.email);
  });

  it('revokes sessions on POST /api/auth/logout and clears cookie', async () => {
    // 1. Log in
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });
    const accessToken = loginRes.body.token;
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // 2. Log out
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookies!)
      .send();

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Verify cookie cleared
    const logoutCookies = logoutRes.headers['set-cookie'];
    expect(logoutCookies).toBeDefined();
    const clearedCookie = Array.isArray(logoutCookies)
      ? logoutCookies.find((c) => c.startsWith('refreshToken='))
      : logoutCookies;
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);

    // 3. Old access token is now rejected on protected route
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(401);
    expect(meRes.body.code).toBe('TOKEN_REVOKED');

    // 4. Old refresh token is rejected
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies!)
      .send();

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.code).toBe('SESSION_REVOKED');
  });

  it('revokes all existing tokens when password is reset', async () => {
    // 1. Log in to get tokens
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });
    const oldAccessToken = loginRes.body.token;

    // 2. Request password reset
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email });

    const devToken = forgotRes.body.devResetToken;
    expect(devToken).toBeDefined();

    // 3. Reset password
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: devToken,
        password: 'NewStrongPassword456!',
      });

    expect(resetRes.status).toBe(200);

    // 4. Pre-reset access token is immediately revoked
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);

    expect(meRes.status).toBe(401);
    expect(meRes.body.code).toBe('TOKEN_REVOKED');

    // 5. New password works on login
    const newLoginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'NewStrongPassword456!',
    });

    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.token).toBeDefined();
  });
});
