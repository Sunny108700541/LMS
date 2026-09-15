import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

const SHUTDOWN_TIMEOUT_MS = 15_000;

let server: Server | undefined;
let shuttingDown = false;

async function start(): Promise<void> {
  // Connect before listening: the process should never accept traffic it cannot serve.
  await connectDatabase();

  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info('API listening', { port: env.PORT, env: env.NODE_ENV, prefix: env.API_PREFIX });
  });

  server.keepAliveTimeout = 65_000; // > typical ALB idle timeout, avoids 502s on keep-alive
  server.headersTimeout = 70_000;
}

/**
 * Graceful shutdown.
 *
 * 1. Stop accepting new connections.
 * 2. Let in-flight requests finish.
 * 3. Close the MongoDB pool so no write is cut mid-flight.
 * 4. Hard-exit if any of that hangs past the timeout.
 */
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown started', { signal });

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }
    await disconnectDatabase();
    clearTimeout(forceExit);
    logger.info('shutdown complete');
    process.exit(exitCode);
  } catch (err) {
    logger.error('error during shutdown', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// An unhandled rejection or uncaught exception leaves the process in an unknown
// state: log it, then leave through the same clean path.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', reason);
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception', err);
  void shutdown('uncaughtException', 1);
});

start().catch((err) => {
  logger.error('failed to start server', err);
  process.exit(1);
});
