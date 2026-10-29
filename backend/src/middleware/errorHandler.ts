import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: number;
  errors?: Record<string, any>;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier format';
  }

  // Mongoose Duplicate Key (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys((err as any).keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}. It must be unique.`;
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e: any) => e.message);
    message = messages.join(', ');
  }

  // Multer Errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    const multerCode = (err as any).code;
    if (multerCode === 'LIMIT_FILE_SIZE' || err.message === 'File too large') {
      message = 'File size limit exceeded (maximum 5MB allowed per image)';
    } else if (multerCode === 'LIMIT_FILE_COUNT' || err.message === 'Too many files') {
      message = 'Maximum of 4 images allowed per property';
    } else {
      message = err.message || 'File upload error';
    }
  }

  // Body parser syntax error (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Log error internally if server-side failure and sanitize in production
  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected internal server error occurred';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}
