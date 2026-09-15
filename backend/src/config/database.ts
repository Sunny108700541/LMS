import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);
// Mongoose buffers commands while disconnected; during shutdown we want fast failures instead.
mongoose.set('bufferCommands', false);

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', err));

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    autoIndex: !env.isProd, // in production build indexes via migration, not on boot
  });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close(false); // false = let in-flight ops finish
  logger.info('MongoDB connection closed');
}

export function databaseIsHealthy(): boolean {
  return mongoose.connection.readyState === 1;
}
