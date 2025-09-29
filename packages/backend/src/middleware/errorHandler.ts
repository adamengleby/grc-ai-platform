import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types/analytics';

/**
 * Global error handling middleware
 */
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Internal server error';

  const response: ApiResponse<null> = {
    success: false,
    error: message,
    timestamp: new Date(),
  };

  // Don't expose stack traces in production
  if (process.env.NODE_ENV === 'development') {
    (response as any).stack = error.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse<null> = {
    success: false,
    error: `Route ${req.originalUrl} not found`,
    timestamp: new Date(),
  };
  
  res.status(404).json(response);
};