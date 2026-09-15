/// <reference path="./types/express.d.ts" />
import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { globalLimiter } from './middleware/rateLimit';
import { databaseIsHealthy } from './config/database';
import { ok } from './utils/response';

export function createApp(): Application {
  const app = express();

  // Behind a load balancer this is what makes req.ip and rate limiting correct.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Credentialed CORS needs an explicit allow-list — never a wildcard.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  // Bodies are small JSON payloads; file uploads go through multer separately.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());
  app.use(hpp()); // collapse duplicated query params (?role=x&role=y)
  app.use(requestContext);
  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    const healthy = databaseIsHealthy();
    return res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: { status: healthy ? 'ok' : 'degraded', database: healthy ? 'up' : 'down', uptime: process.uptime() },
    });
  });

  app.get(env.API_PREFIX, (_req, res) => ok(res, { name: 'LMS API', version: '1.0.0' }));
  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
