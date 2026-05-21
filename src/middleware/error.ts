import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { InvalidUrlError } from '../utils/url.js';
import { InvalidSlugError } from '../utils/slug.js';
import {
  ExpirationInPastError,
  SlugTakenError,
} from '../services/links.service.js';
import { logger } from '../utils/logger.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `No route matched ${req.method} ${req.originalUrl}`,
    },
  } satisfies ApiErrorBody);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    } satisfies ApiErrorBody);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request body is invalid',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    } satisfies ApiErrorBody);
    return;
  }
  if (err instanceof InvalidUrlError) {
    res.status(400).json({
      error: { code: 'invalid_url', message: err.message },
    } satisfies ApiErrorBody);
    return;
  }
  if (err instanceof InvalidSlugError) {
    res.status(400).json({
      error: { code: 'invalid_alias', message: err.message },
    } satisfies ApiErrorBody);
    return;
  }
  if (err instanceof SlugTakenError) {
    res.status(409).json({
      error: { code: 'alias_taken', message: err.message },
    } satisfies ApiErrorBody);
    return;
  }
  if (err instanceof ExpirationInPastError) {
    res.status(400).json({
      error: { code: 'expiration_in_past', message: err.message },
    } satisfies ApiErrorBody);
    return;
  }
  if (err instanceof RangeError) {
    res.status(400).json({
      error: { code: 'bad_request', message: err.message },
    } satisfies ApiErrorBody);
    return;
  }

  logger.error({ err }, 'unhandled error');
  res.status(500).json({
    error: { code: 'internal_error', message: 'Internal server error' },
  } satisfies ApiErrorBody);
}
