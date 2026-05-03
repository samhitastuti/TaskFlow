import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { errorHandler } from './utils/errors';
import redis from './lib/redis';
import { authRoutes } from './routes/auth';
import { taskRoutes } from './routes/tasks';
import { scheduleRoutes } from './routes/schedule';
import { sessionRoutes } from './routes/sessions';
import { analyticsRoutes } from './routes/analytics';
import { userRoutes } from './routes/users';
import { syncRoutes } from './routes/sync';
import { notificationRoutes } from './routes/notifications';

export const buildApp = async () => {
  const app = fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
      },
    },
  });

  // Plugins
  await app.register(cors);
  await app.register(helmet);
  await app.register(cookie);

/*
  if (process.env.NODE_ENV !== 'test' && !(redis as any).isMock) {
    await app.register(rateLimit, {
      redis,
      max: 100,
      timeWindow: '1 minute',
    });
  }
*/

  // JWT setup
  // In production, these would be loaded from env or a vault
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-dev-key',
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
    sign: {
      expiresIn: '15m',
    },
  });

  // Custom Error Handler
  app.setErrorHandler(errorHandler);

  // Root route
  app.get('/', async () => {
    return { status: 'ok', message: 'TaskFlow API is running', version: '1.0.0' };
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(taskRoutes, { prefix: '/api/v1/tasks' });
  await app.register(scheduleRoutes, { prefix: '/api/v1/schedule' });
  await app.register(sessionRoutes, { prefix: '/api/v1/sessions' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(syncRoutes, { prefix: '/api/v1/sync' });
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });

  return app;
};
