import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { standardLimiter } from './middleware/rateLimiter';

export function createApp(): Application {
  const app: Application = express();

  // HTTP Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Strict CORS configuration supporting multi-origin and production Vercel frontend deployments
  const configuredOrigins = env.APP_ORIGIN
    ? env.APP_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
    : [];
  const allowedOrigins = Array.from(
    new Set([...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = origin.replace(/\/+$/, '');
        const isExplicitlyAllowed = allowedOrigins.includes(normalizedOrigin);
        // Automatically support Vercel preview deployments that match the specific project prefix
        const vercelPrefixes = allowedOrigins
          .filter((ao) => ao.includes('.vercel.app'))
          .flatMap((ao) => {
            const host = ao.replace(/^https?:\/\//, '').replace(/\.vercel\.app$/, '');
            return [host, host.split('-')[0]];
          })
          .filter(Boolean);

        const isVercelDomain =
          vercelPrefixes.length > 0 &&
          vercelPrefixes.some((prefix) =>
            new RegExp(`^https:\\/\\/${prefix}(-[a-zA-Z0-9_-]+)?\\.vercel\\.app$`).test(normalizedOrigin)
          );

        if (isExplicitlyAllowed || isVercelDomain) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // JSON and URL-encoded body parsers with bounded limit
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Safe Request Logger (no passwords or tokens logged)
  app.use((req: Request, _res: Response, next) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${req.method} ${req.path}`);
    }
    next();
  });

  // Serve local uploaded files statically
  const uploadsPath = path.resolve(__dirname, '../uploads');
  app.use('/uploads', express.static(uploadsPath));

  // Root landing route
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'SapphireIQ RealEstate API',
      status: 'online',
      endpoints: {
        health: '/api/health',
        properties: '/api/properties',
      },
    });
  });

  // Global standard rate limiter on API
  app.use('/api', standardLimiter);

  // Mount API routers
  app.use('/api', routes);

  // 404 handler for unhandled API routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Centralized Error Middleware
  app.use(errorHandler);

  return app;
}

export default createApp;
