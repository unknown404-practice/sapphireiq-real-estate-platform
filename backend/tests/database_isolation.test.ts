import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { validateTestDatabaseName, parseDatabaseNameFromUri } from './setup';
import { seedDatabase } from '../src/scripts/seed';
import { User } from '../src/models/User';
import { Property } from '../src/models/Property';

describe('SAFE-01: Critical Database Test Isolation & Seed Protection', () => {
  describe('Test Database Name Validation', () => {
    it('rejects missing or empty database names', () => {
      expect(validateTestDatabaseName(null)).toBe(false);
      expect(validateTestDatabaseName(undefined)).toBe(false);
      expect(validateTestDatabaseName('')).toBe(false);
      expect(validateTestDatabaseName('   ')).toBe(false);
    });

    it('rejects production, core application, and administrative database names', () => {
      expect(validateTestDatabaseName('sapphireiq')).toBe(false);
      expect(validateTestDatabaseName('SapphireIQ')).toBe(false);
      expect(validateTestDatabaseName('production')).toBe(false);
      expect(validateTestDatabaseName('prod')).toBe(false);
      expect(validateTestDatabaseName('admin')).toBe(false);
      expect(validateTestDatabaseName('live')).toBe(false);
      expect(validateTestDatabaseName('main')).toBe(false);
    });

    it('strictly accepts databases designated for automated testing', () => {
      expect(validateTestDatabaseName('sapphireiq_test')).toBe(true);
      expect(validateTestDatabaseName('test')).toBe(true);
      expect(validateTestDatabaseName('app_test_db')).toBe(true);
      expect(validateTestDatabaseName('integration_tests')).toBe(true);
    });
  });

  describe('Database URI Extraction', () => {
    it('correctly extracts database name from standard mongodb:// URIs', () => {
      const uri = 'mongodb://localhost:27017/sapphireiq_test?retryWrites=true&w=majority';
      expect(parseDatabaseNameFromUri(uri)).toBe('sapphireiq_test');
    });

    it('correctly extracts database name from SRV mongodb+srv:// connection strings', () => {
      const uri = 'mongodb+srv://db_user:SecPass2026@cluster0.abcde.mongodb.net/sapphireiq_test?appName=Cluster0';
      expect(parseDatabaseNameFromUri(uri)).toBe('sapphireiq_test');
    });

    it('returns null for URIs missing a database segment', () => {
      const bareUri = 'mongodb+srv://db_user:SecPass2026@cluster0.abcde.mongodb.net/?appName=Cluster0';
      expect(parseDatabaseNameFromUri(bareUri)).toBe(null);
    });
  });

  describe('Active Connection Isolation Verification', () => {
    it('verifies that active test runner connects to an approved test database', () => {
      expect(mongoose.connection.readyState).toBe(1); // Connected
      const activeDbName = mongoose.connection.name;
      expect(activeDbName).toBeDefined();
      expect(validateTestDatabaseName(activeDbName)).toBe(true);
      expect(activeDbName.toLowerCase()).not.toBe('sapphireiq');
    });
  });

  describe('Non-Destructive Seed Protection', () => {
    it('strictly refuses execution when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expect(seedDatabase()).rejects.toThrow(/Refusing to seed database in production mode/);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('executes idempotently without deleting pre-existing non-seed records', async () => {
      // 1. Create an existing property that is NOT part of seed data
      const existingUser = await User.create({
        name: 'Pre-existing Independent User',
        email: 'independent.user@example.com',
        password: 'Password123!',
        role: 'user',
        phone: '+91 91234 56789',
      });

      const independentProperty = await Property.create({
        title: 'Unique Custom Apartment Not In Seed',
        description: 'Independent test property that must never be deleted by seeding.',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 99000000,
        city: 'Pune',
        state: 'Maharashtra',
        locality: 'Koregaon Park',
        pincode: '411001',
        bedrooms: 5,
        bathrooms: 5,
        areaSqFt: 6000,
        owner: existingUser._id,
      });

      // 2. Run seed
      await seedDatabase();

      // 3. Verify that independent record was NOT purged by seeding
      const foundIndependent = await Property.findById(independentProperty._id);
      expect(foundIndependent).not.toBeNull();
      expect(foundIndependent?.title).toBe('Unique Custom Apartment Not In Seed');

      // 4. Run seed a second time to verify idempotency (no duplicate properties created)
      const initialCount = await Property.countDocuments();
      await seedDatabase();
      const secondCount = await Property.countDocuments();
      expect(secondCount).toBe(initialCount);
    });
  });
});
