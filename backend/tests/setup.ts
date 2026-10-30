import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let mongoServer: MongoMemoryServer | null = null;

/**
 * Validates that a database name is strictly designated for automated testing.
 * Rejects production, development, or unisolated database names.
 */
export function validateTestDatabaseName(dbName?: string | null): boolean {
  if (!dbName) return false;
  const lower = dbName.toLowerCase().trim();
  // Reject production and core development application database names
  const forbiddenNames = ['sapphireiq', 'production', 'prod', 'admin', 'live', 'main'];
  if (forbiddenNames.includes(lower)) {
    return false;
  }
  // Must explicitly contain 'test'
  return lower.includes('test');
}

/**
 * Robustly parses the database name from a MongoDB connection string.
 * Supports standard (mongodb://) and DNS seedlist (mongodb+srv://) URIs.
 */
export function parseDatabaseNameFromUri(uri: string): string | null {
  if (!uri || typeof uri !== 'string') return null;
  try {
    const cleanUri = uri.trim();
    // Normalize protocol for URL parser
    const httpEquiv = cleanUri.replace(/^mongodb(?:\+srv)?:\/\//i, 'http://');
    const parsed = new URL(httpEquiv);
    const db = parsed.pathname.replace(/^\//, '').split('?')[0];
    return db ? decodeURIComponent(db) : null;
  } catch {
    const match = uri.match(/\/([^/?]+)(?:\?|$)/);
    return match ? match[1] : null;
  }
}

beforeAll(async () => {
  // CRITICAL SECURITY ENFORCEMENT:
  // Never automatically derive test databases from MONGODB_URI via substring replacement.
  // Tests must ONLY connect to an explicit TEST_MONGODB_URI or an isolated MongoMemoryServer.
  const explicitTestUri = process.env.TEST_MONGODB_URI;

  if (explicitTestUri) {
    const dbName = parseDatabaseNameFromUri(explicitTestUri);
    if (!validateTestDatabaseName(dbName)) {
      throw new Error(
        `[Fatal Test Isolation Violation] TEST_MONGODB_URI points to an unauthorized or non-test database: "${dbName}". ` +
        `Tests must strictly target a database containing "test" (e.g. sapphireiq_test) to avoid corrupting application data.`
      );
    }

    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(explicitTestUri, { serverSelectionTimeoutMS: 5000 });
      }
      return;
    } catch (err: any) {
      throw new Error(`[Test Isolation Error] Explicit TEST_MONGODB_URI connection failed: ${err.message}`);
    }
  }

  // Safe default: Launch dedicated in-memory MongoDB instance
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  } catch (err) {
    console.error('Failed to initialize in-memory MongoDB:', err);
    throw err;
  }
}, 300000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    // Defense-in-depth: Verify connected database is NOT production before running cleanups
    const activeDbName = mongoose.connection.name;
    if (activeDbName && !validateTestDatabaseName(activeDbName)) {
      throw new Error(
        `[CRITICAL DATA SAFETY GUARD] Test cleanup aborted! Connected to non-test database "${activeDbName}". ` +
        `deleteMany is forbidden on non-test databases.`
      );
    }

    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});
