import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Property } from '../src/models/Property';

const app = createApp();

describe('Properties Domain and Ownership Security', () => {
  let userAToken: string;
  let userBToken: string;

  beforeEach(async () => {
    // Register User A
    const resA = await request(app).post('/api/auth/register').send({
      name: 'Owner User A',
      email: 'userA@example.com',
      password: 'Password123!',
    });
    userAToken = resA.body.token;

    // Register User B
    const resB = await request(app).post('/api/auth/register').send({
      name: 'Intruder User B',
      email: 'userB@example.com',
      password: 'Password123!',
    });
    userBToken = resB.body.token;
  });

  it('User A creates a property successfully with server-derived owner', async () => {
    const propData = {
      title: 'Modern 2BHK Apartment in Bandra',
      description: 'Spacious flat close to Bandstand with balconies.',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 25000000,
      city: 'Mumbai',
      state: 'Maharashtra',
      bedrooms: 2,
      bathrooms: 2,
      areaSqFt: 1050,
      amenities: ['Gym', 'Parking'],
    };

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(propData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(propData.title);
    expect(res.body.data.price).toBe(propData.price);
    expect(res.body.data.owner).toBeDefined();

    // Verify unauthenticated user cannot create property
    const unauthRes = await request(app).post('/api/properties').send(propData);
    expect(unauthRes.status).toBe(401);
  });

  it('rejects creation if image count exceeds 4', async () => {
    const propWith5Images = {
      title: 'Villa with too many photos',
      description: 'Testing image limit',
      propertyType: 'villa',
      listingType: 'sale',
      price: 15000000,
      city: 'Bengaluru',
      state: 'Karnataka',
      images: [
        { url: 'https://example.com/1.jpg' },
        { url: 'https://example.com/2.jpg' },
        { url: 'https://example.com/3.jpg' },
        { url: 'https://example.com/4.jpg' },
        { url: 'https://example.com/5.jpg' },
      ],
    };

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(propWith5Images);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Maximum 4 images');
  });

  it('MANDATORY: User B cannot modify or delete User A property (403 Forbidden)', async () => {
    // 1. User A creates a property
    const createRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Original Title by User A',
        description: 'Original Description',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 10000000,
        city: 'Delhi',
        state: 'Delhi',
      });

    const propertyId = createRes.body.data._id;
    expect(propertyId).toBeDefined();

    // 2. User B tries to PATCH User A's property
    const patchRes = await request(app)
      .patch(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'Hacked by User B!',
        price: 1,
      });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.success).toBe(false);
    expect(patchRes.body.error).toContain('Forbidden');

    // 3. User B tries to DELETE User A's property
    const deleteRes = await request(app)
      .delete(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.success).toBe(false);
    expect(deleteRes.body.error).toContain('Forbidden');

    // 4. Verify property remains completely unchanged in the database
    const dbProperty = await Property.findById(propertyId);
    expect(dbProperty).not.toBeNull();
    expect(dbProperty?.title).toBe('Original Title by User A');
    expect(dbProperty?.price).toBe(10000000);
  });

  it('User A can successfully update and delete their own property', async () => {
    const createRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'User A Villa',
        description: 'Nice villa',
        propertyType: 'villa',
        listingType: 'rent',
        price: 45000,
        city: 'Kolkata',
        state: 'West Bengal',
      });

    const propertyId = createRes.body.data._id;

    // User A updates property
    const updateRes = await request(app)
      .patch(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        price: 50000,
        title: 'User A Renovated Villa',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.price).toBe(50000);
    expect(updateRes.body.data.title).toBe('User A Renovated Villa');

    // User A deletes property
    const deleteRes = await request(app)
      .delete(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(deleteRes.status).toBe(200);
    const dbCheck = await Property.findById(propertyId);
    expect(dbCheck).toBeNull();
  });

  it('GET /api/properties filters by city, type, and bounded pagination', async () => {
    // Seed 2 properties
    await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Bengaluru Tech Park Flat',
        description: 'Near tech hub',
        propertyType: 'apartment',
        listingType: 'rent',
        price: 30000,
        city: 'Bengaluru',
        state: 'Karnataka',
        bedrooms: 2,
      });

    await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Mumbai Luxury Villa',
        description: 'Seaside luxury',
        propertyType: 'villa',
        listingType: 'sale',
        price: 50000000,
        city: 'Mumbai',
        state: 'Maharashtra',
        bedrooms: 4,
      });

    // Filter by city
    const cityRes = await request(app).get('/api/properties?city=Bengaluru');
    expect(cityRes.status).toBe(200);
    expect(cityRes.body.data.length).toBe(1);
    expect(cityRes.body.data[0].city).toBe('Bengaluru');

    // Filter by listingType
    const rentRes = await request(app).get('/api/properties?listingType=rent');
    expect(rentRes.status).toBe(200);
    expect(rentRes.body.data.length).toBe(1);
    expect(rentRes.body.data[0].listingType).toBe('rent');

    // Check pagination metadata
    expect(cityRes.body.pagination).toBeDefined();
    expect(cityRes.body.pagination.total).toBe(1);
    expect(cityRes.body.pagination.page).toBe(1);
  });

  it('rejects creation with invalid propertyType, listingType, or negative price', async () => {
    // Negative price
    const negPriceRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Invalid Property',
        description: 'Testing validation',
        propertyType: 'apartment',
        listingType: 'sale',
        price: -500,
        city: 'Mumbai',
        state: 'Maharashtra',
      });
    expect(negPriceRes.status).toBe(400);
    expect(negPriceRes.body.error).toContain('Price must be a valid non-negative number');

    // Invalid property type
    const invTypeRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Invalid Type Property',
        description: 'Testing validation',
        propertyType: 'spaceship' as any,
        listingType: 'sale',
        price: 5000000,
        city: 'Mumbai',
        state: 'Maharashtra',
      });
    expect(invTypeRes.status).toBe(400);
    expect(invTypeRes.body.error).toContain('Invalid property type');

    // Invalid listing type
    const invListingRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Invalid Listing Type',
        description: 'Testing validation',
        propertyType: 'apartment',
        listingType: 'steal' as any,
        price: 5000000,
        city: 'Mumbai',
        state: 'Maharashtra',
      });
    expect(invListingRes.status).toBe(400);
    expect(invListingRes.body.error).toContain('Invalid listing type');
  });

  it('supports updating property via PUT method', async () => {
    const createRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Original Title',
        description: 'Original Description',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 7500000,
        city: 'Pune',
        state: 'Maharashtra',
      });
    const propId = createRes.body.data._id;

    const putRes = await request(app)
      .put(`/api/properties/${propId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        price: 8000000,
        title: 'Updated Title via PUT',
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.price).toBe(8000000);
    expect(putRes.body.data.title).toBe('Updated Title via PUT');
  });

  it('prevents non-admin user from setting featured status on create or update', async () => {
    // 1. Non-admin attempts to create property with featured: true
    const createRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Luxury Villa attempt featured',
        description: 'Trying to elevate placement',
        propertyType: 'villa',
        listingType: 'sale',
        price: 90000000,
        city: 'Goa',
        state: 'Goa',
        featured: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.featured).toBe(false);

    const propId = createRes.body.data._id;

    // 2. Non-admin attempts to PATCH featured: true
    const patchRes = await request(app)
      .patch(`/api/properties/${propId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        featured: true,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.featured).toBe(false);
  });

  it('rejects updates with invalid bedrooms, bathrooms, or area values', async () => {
    const createRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'Spec Validation Flat',
        description: 'Testing numerical validations',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 5000000,
        city: 'Chennai',
        state: 'Tamil Nadu',
      });

    const propId = createRes.body.data._id;

    // Negative bedrooms
    const negBedRes = await request(app)
      .patch(`/api/properties/${propId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ bedrooms: -2 });
    expect(negBedRes.status).toBe(400);
    expect(negBedRes.body.error).toContain('Bedrooms must be a valid non-negative number');

    // Negative bathrooms
    const negBathRes = await request(app)
      .patch(`/api/properties/${propId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ bathrooms: -1 });
    expect(negBathRes.status).toBe(400);
    expect(negBathRes.body.error).toContain('Bathrooms must be a valid non-negative number');

    // Empty title
    const emptyTitleRes = await request(app)
      .patch(`/api/properties/${propId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ title: '   ' });
    expect(emptyTitleRes.status).toBe(400);
    expect(emptyTitleRes.body.error).toContain('Title cannot be empty');
  });
});
