import dotenv from 'dotenv';
import path from 'path';

// Load local package .env first, then root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

export const env = {
  NODE_ENV: nodeEnv,
  PORT: parseInt(process.env.PORT || '4000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/sapphireiq',
  JWT_SECRET: process.env.JWT_SECRET || (isProd ? '' : 'sapphireiq_secret_super_secure_key_1234567890'),
  JWT_EXPIRES_IN: '7d',
  APP_ORIGIN: process.env.APP_ORIGIN || 'http://localhost:5173',

  // Email / SMTP
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'no-reply@sapphireiq.local',

  // ImageKit
  IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY || '',
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY || '',
  IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT || '',
};

export const isProduction = isProd;
