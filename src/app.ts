import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger.js';
import { apiRouter } from './routes/api.js';
import { redirectRouter } from './routes/redirect.js';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// `here` is dist/ at runtime; the static assets live at <repo>/public.
const PUBLIC_DIR = path.resolve(here, '..', 'public');

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '32kb' }));
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(healthRouter);
  app.use('/api', apiRouter);
  app.use(
    express.static(PUBLIC_DIR, {
      index: 'index.html',
      fallthrough: true,
      maxAge: '1h',
    }),
  );
  app.use(redirectRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
