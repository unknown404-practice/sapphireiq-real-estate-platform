import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Viewing Appointments and Privacy Controls', () => {
  let userAToken: string;
  let userBToken: string;
  let propertyId: string;

  beforeEach(async () => {
    // Register User A (Property Owner)
    const resA = await request(app).post('/api/auth/register').send({
      name: 'Owner Alice',
      email: 'alice@example.com',
      password: 'Password123!',
    });
    userAToken = resA.body.token;

    // Register User B (Viewer / Buyer)
    const resB = await request(app).post('/api/auth/register').send({
      name: 'Buyer Bob',
      email: 'bob@example.com',
      password: 'Password123!',
    });
    userBToken = resB.body.token;

    // Create a property
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Penthouse for Viewing',
        description: 'Exclusive listing open for viewings',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 35000000,
        city: 'Mumbai',
        state: 'Maharashtra',
      });
    propertyId = propRes.body.data._id;
  });

  it('allows public guest booking with valid contact and future date', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/appointments/guest')
      .send({
        property: propertyId,
        guestName: 'Guest John',
        guestEmail: 'john@guest.com',
        guestPhone: '+91 9123456780',
        scheduledAt: futureDate,
        notes: 'Would like to visit around 3 PM',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.guestName).toBe('Guest John');
  });

  it('rejects guest booking with past date or missing fields', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/appointments/guest')
      .send({
        property: propertyId,
        guestName: 'Guest Past',
        guestEmail: 'past@guest.com',
        guestPhone: '+91 9123456780',
        scheduledAt: pastDate,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('future date');
  });

  it('allows authenticated booking deriving user identity', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        property: propertyId,
        scheduledAt: futureDate,
        notes: 'Pre-approved loan in place',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.user).toBeDefined();

    // Verify User B can see appointment in /mine
    const mineRes = await request(app)
      .get('/api/appointments/mine')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data.length).toBe(1);
    expect(mineRes.body.data[0]._id).toBe(res.body.data._id);
  });

  it('enforces privacy: unauthorized user cannot cancel another appointment', async () => {
    // Register User C
    const resC = await request(app).post('/api/auth/register').send({
      name: 'Stranger Charlie',
      email: 'charlie@example.com',
      password: 'Password123!',
    });
    const userCToken = resC.body.token;

    // Bob books an appointment
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        property: propertyId,
        scheduledAt: futureDate,
      });
    const appointmentId = bookRes.body.data._id;

    // Charlie tries to cancel Bob's appointment -> 403 Forbidden!
    const cancelRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${userCToken}`);

    expect(cancelRes.status).toBe(403);
    expect(cancelRes.body.success).toBe(false);
    expect(cancelRes.body.error).toContain('Forbidden');

    // Bob cancels his own appointment -> 200 Success!
    const bobCancelRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(bobCancelRes.status).toBe(200);
    expect(bobCancelRes.body.data.status).toBe('cancelled');

    // Cannot re-cancel already cancelled appointment
    const reCancelRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(reCancelRes.status).toBe(400);
    expect(reCancelRes.body.error).toContain('already cancelled');
  });

  it('rejects viewing booking if user is the property owner', async () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const selfBookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        property: propertyId,
        scheduledAt: futureDate,
      });

    expect(selfBookRes.status).toBe(400);
    expect(selfBookRes.body.success).toBe(false);
    expect(selfBookRes.body.error).toContain('own property');
  });

  it('rejects duplicate pending appointment on same property', async () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    // First booking
    const firstRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        property: propertyId,
        scheduledAt: futureDate,
      });
    expect(firstRes.status).toBe(201);

    // Second booking attempt by same user on same property
    const secondRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        property: propertyId,
        scheduledAt: futureDate,
      });
    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error).toContain('already have an active viewing appointment');
  });

  it('prevents TOCTOU race conditions under simultaneous concurrent booking requests', async () => {
    const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();

    // Fire 2 concurrent guest viewing requests with the exact same email and property
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/appointments/guest')
        .send({
          property: propertyId,
          guestName: 'Concurrent Tester',
          guestEmail: 'concurrent@example.com',
          guestPhone: '+91 9123456780',
          scheduledAt: futureDate,
        }),
      request(app)
        .post('/api/appointments/guest')
        .send({
          property: propertyId,
          guestName: 'Concurrent Tester',
          guestEmail: 'concurrent@example.com',
          guestPhone: '+91 9123456780',
          scheduledAt: futureDate,
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('allows property owner to confirm appointment and rejects unauthorized status change', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // User B books viewing
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        property: propertyId,
        scheduledAt: futureDate,
      });
    const appointmentId = bookRes.body.data._id;

    // User B (non-owner) tries to confirm -> 403 Forbidden
    const unauthStatusRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ status: 'confirmed' });
    expect(unauthStatusRes.status).toBe(403);

    // User A (Property Owner) confirms -> 200 Success
    const ownerStatusRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ status: 'confirmed' });
    expect(ownerStatusRes.status).toBe(200);
    expect(ownerStatusRes.body.data.status).toBe('confirmed');
  });

  it('rejects guest booking if guest email matches the property owner email', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/appointments/guest')
      .send({
        property: propertyId,
        guestName: 'Self Alice',
        guestEmail: 'alice@example.com', // User A is the owner of propertyId
        guestPhone: '+91 9999999999',
        scheduledAt: futureDate,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot schedule a viewing appointment for your own property');
  });

  it('rejects appointments scheduled more than 1 year in advance', async () => {
    const farFutureDate = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        property: propertyId,
        scheduledAt: farFutureDate,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be scheduled more than 1 year in advance');
  });

  it('allows authenticated user to cancel their viewing appointment originally booked as guest', async () => {
    const futureDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Guest books with bob@example.com (User B's email)
    const guestBookingRes = await request(app)
      .post('/api/appointments/guest')
      .send({
        property: propertyId,
        guestName: 'Buyer Bob Guest',
        guestEmail: 'bob@example.com',
        guestPhone: '+91 9876543210',
        scheduledAt: futureDate,
      });

    expect(guestBookingRes.status).toBe(201);
    const appointmentId = guestBookingRes.body.data._id;

    // 2. User B logs in and cancels their guest-booked appointment
    const cancelRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // 3. Owner or user attempts to reopen cancelled appointment -> 400 rejected
    const reopenRes = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ status: 'confirmed' });

    expect(reopenRes.status).toBe(400);
    expect(reopenRes.body.error).toContain('Cancelled appointments cannot be reopened');
  });
});
