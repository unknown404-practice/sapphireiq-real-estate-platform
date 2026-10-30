import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { standardLimiter } from './middleware/rateLimiter';

export function createApp(): Application {
  const app: Application = express();

  // NET-01: Trust Render edge reverse proxy (1 hop) for accurate client IP resolution & rate limiting
  app.set('trust proxy', 1);

  // HTTP Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Cookie Parser for secure HttpOnly session refresh tokens
  app.use(cookieParser());

  // SEC-03: Strict CORS configuration supporting multi-origin and verified production Vercel deployments
  const isProd = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';
  const rawOrigins = (process.env.APP_ORIGIN !== undefined ? process.env.APP_ORIGIN : env.APP_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  // In production, strictly disallow localhost and loopback interfaces
  const configuredOrigins = isProd
    ? rawOrigins.filter((o) => !o.includes('localhost') && !o.includes('127.0.0.1'))
    : rawOrigins;

  // In non-production, include local development origins
  const devOrigins = isProd
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:4173'];

  const allowedOrigins = Array.from(new Set([...configuredOrigins, ...devOrigins]));

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

        // Strict Vercel preview domain pattern matching:
        // Must strictly match official project prefix without splitting by hyphen
        const isStrictVercelPreview = /^https:\/\/sapphireiq-real-estate-platform-[a-z0-9_-]+\.vercel\.app$/i.test(
          normalizedOrigin
        );

        if (isExplicitlyAllowed || isStrictVercelPreview) {
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

  // Safe Request Logger and Client IP Resolution header
  app.use((req: Request, res: Response, next) => {
    if (req.ip) {
      res.setHeader('X-Client-IP', req.ip);
    }
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
