import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';

const app = createApp();

describe('Authentication API', () => {
  const testUser = {
    name: 'Test Investor',
    email: 'investor@example.com',
    password: 'SecurePassword123!',
    phone: '+91 9876543210',
  };

  it('registers a new user successfully and hashes password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.user.password).toBeUndefined();

    // Verify in database that password was hashed
    const dbUser = await User.findOne({ email: testUser.email.toLowerCase() }).select('+password');
    expect(dbUser).not.toBeNull();
    expect(dbUser?.password).not.toBe(testUser.password);
    expect(dbUser?.password.startsWith('$2')).toBe(true);
  });

  it('rejects duplicate email registration with 409', async () => {
    // First registration
    await request(app).post('/api/auth/register').send(testUser);

    // Duplicate registration attempt
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('already exists');
  });

  it('rejects registration with short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Short Pass',
      email: 'short@example.com',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('at least 6 characters');
  });

  it('authenticates valid credentials on login', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe(testUser.name);
  });

  it('rejects wrong password with generic 401 error', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('GET /api/auth/me returns profile for authenticated user', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const token = regRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
  });

  it('GET /api/users/me returns profile for authenticated user (Guide specification)', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const token = regRes.body.token;

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
  });

  it('GET /api/auth/me returns 401 when no token is supplied', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('safe forgot-password and reset-password flow', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const initialToken = regRes.body.token;

    // Verify initial token works prior to password reset
    const preResetCheck = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${initialToken}`);
    expect(preResetCheck.status).toBe(200);

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.success).toBe(true);
    const devToken = forgotRes.body.devResetToken;
    expect(devToken).toBeDefined();

    // Reset password using the token
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: devToken,
        password: 'BrandNewPassword123!',
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Verify initial token is now REVOKED (tokenVersion mismatch)
    const postResetCheck = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${initialToken}`);
    expect(postResetCheck.status).toBe(401);
    expect(postResetCheck.body.error).toContain('revoked');

    // Verify login with new password works
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'BrandNewPassword123!',
    });
    expect(loginRes.status).toBe(200);

    // Verify new token works
    const newMeCheck = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(newMeCheck.status).toBe(200);

    // Verify reset token cannot be reused
    const reuseRes = await request(app).post('/api/auth/reset-password').send({
      token: devToken,
      password: 'AnotherPassword123!',
    });
    expect(reuseRes.status).toBe(400);
  });
});
