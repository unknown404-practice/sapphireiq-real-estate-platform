import { createApp } from './app';
import { env, isProduction } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';

async function startServer(): Promise<void> {
  try {
    // Validate critical environment
    if (isProduction && (!env.JWT_SECRET || env.JWT_SECRET.length < 16)) {
      throw new Error('[Fatal Security Error] JWT_SECRET must be explicitly set and at least 16 characters in production mode.');
    } else if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
      console.warn('[Security Warning] JWT_SECRET is missing or short. Using local fallback.');
    }

    // Connect to Database
    await connectDatabase();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`[Server] SapphireIQ Backend running on http://localhost:${env.PORT}`);
      console.log(`[Server] Health check available at http://localhost:${env.PORT}/api/health`);
    });

    // Graceful Shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        console.log('[Server] Closed remaining connections. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
