import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let mongoServer: MongoMemoryServer | null = null;

beforeAll(async () => {
  const testUri =
    process.env.TEST_MONGODB_URI ||
    (process.env.MONGODB_URI
      ? process.env.MONGODB_URI.replace('/sapphireiq?', '/sapphireiq_test?')
      : undefined);

  if (testUri) {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
      }
      return;
    } catch (err: any) {
      console.warn('TEST_MONGODB_URI connection failed, falling back to MongoMemoryServer:', err.message);
    }
  }

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  } catch (err) {
    console.error('Failed to initialize in-memory MongoDB:', err);
    throw err;
  }
}, 60000);

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
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});
