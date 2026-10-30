import { createApp } from './app';
import { env, isProduction } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { retryOrphanedUploadCleanups, reconcileDiskOrphans } from './services/imageService';

async function startServer(): Promise<void> {
  try {
    // Validate critical environment
    if (isProduction && (!env.JWT_SECRET || env.JWT_SECRET.length < 16)) {
      throw new Error('[Fatal Security Error] JWT_SECRET must be explicitly set and at least 16 characters in production mode.');
    } else if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
      console.warn('[Security Warning] JWT_SECRET is missing or short. Using local fallback.');
    }

    if (isProduction && !env.IMAGEKIT_PRIVATE_KEY) {
      console.warn('[Storage Warning] IMAGEKIT_PRIVATE_KEY is not configured in production. Ephemeral disk fallback is disabled; image uploads will be rejected until configured.');
    }

    // Connect to Database
    await connectDatabase();

    // Scheduled background orphan cleaner timer
    let sweeperTimer: NodeJS.Timeout | null = null;

    // Run automated orphan sweeper every 6 hours in non-test mode
    if (process.env.NODE_ENV !== 'test') {
      const SWEEPER_INTERVAL_MS = 6 * 60 * 60 * 1000;
      sweeperTimer = setInterval(async () => {
        try {
          const queueResult = await retryOrphanedUploadCleanups();
          if (queueResult.processed > 0) {
            console.log(`[Sweeper] Cleaned up ${queueResult.resolved} orphaned uploads from queue.`);
          }

          const diskResult = await reconcileDiskOrphans();
          if (diskResult.removed > 0) {
            console.log(`[Sweeper] Reconciled and removed ${diskResult.removed} stranded unreferenced disk files.`);
          }
        } catch (err: any) {
          console.error('[Sweeper] Background cleanup error:', err.message);
        }
      }, SWEEPER_INTERVAL_MS);
      sweeperTimer.unref();
    }

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`[Server] SapphireIQ Backend running on http://localhost:${env.PORT}`);
      console.log(`[Server] Health check available at http://localhost:${env.PORT}/api/health`);
    });

    // Graceful Shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      if (sweeperTimer) {
        clearInterval(sweeperTimer);
      }
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
