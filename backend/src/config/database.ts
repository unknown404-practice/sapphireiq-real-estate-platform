import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  // If already connected to an active database (e.g. in test environment), reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const mongoUri = uri || env.MONGODB_URI;
  
  // Mask credentials in connection string for safe logging
  const safeUri = mongoUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.+)/, '$1***$2');
  
  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[Database] MongoDB connected: ${safeUri} (host: ${conn.connection.host})`);
    return conn;
  } catch (error) {
    console.error(`[Database] Error connecting to MongoDB (${safeUri}):`, error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[Database] Disconnected from MongoDB');
  }
}
