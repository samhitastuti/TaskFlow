import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { loginSchema, registerSchema } from '../schemas/auth';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Per-IP auth rate limit: 10 requests per 15 minutes
const AUTH_RATE_LIMIT = { max: 10, timeWindow: '15 minutes' };

function refreshFamilyKey(fid: string) {
  return `refresh_family:${fid}`;
}

async function issueTokens(app: FastifyInstance, userId: string) {
  const fid = randomUUID();
  const jti = randomUUID();

  const accessToken = app.jwt.sign({ sub: userId });
  const refreshToken = app.jwt.sign({ sub: userId, fid, jti }, { expiresIn: '30d' });

  await redis.setex(refreshFamilyKey(fid), REFRESH_TTL_SECONDS, jti);

  return { accessToken, refreshToken };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (req, reply) => {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return reply.status(409).send({ message: 'User already exists' });
    }

    const password_hash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        display_name: data.display_name,
        password_hash,
      },
    });

    const { accessToken, refreshToken } = await issueTokens(app, user.id);

    reply
      .setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })
      .send({
        data: {
          access_token: accessToken,
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            onboarding_completed: user.onboarding_completed,
          },
        },
      });
  });

  app.post('/login', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (req, reply) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_seen_at: new Date() },
    });

    const { accessToken, refreshToken } = await issueTokens(app, user.id);

    reply
      .setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })
      .send({
        data: {
          access_token: accessToken,
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            onboarding_completed: user.onboarding_completed,
          },
        },
      });
  });

  app.post('/refresh', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (req, reply) => {
    const rawToken = req.cookies.refreshToken;
    if (!rawToken) {
      return reply.status(401).send({ message: 'No refresh token' });
    }

    let decoded: { sub: string; fid: string; jti: string };
    try {
      decoded = (await app.jwt.verify(rawToken)) as any;
    } catch {
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }

    const { sub: userId, fid, jti } = decoded;
    if (!fid || !jti) {
      return reply.status(401).send({ message: 'Invalid refresh token format' });
    }

    const storedJti = await redis.get(refreshFamilyKey(fid));

    if (!storedJti) {
      return reply.status(401).send({ message: 'Refresh token has been revoked' });
    }

    if (storedJti !== jti) {
      // Reuse detected — invalidate entire family and log security event
      await redis.del(refreshFamilyKey(fid));
      req.log.warn({ userId, fid }, 'Refresh token reuse detected — family invalidated');
      return reply.status(401).send({ message: 'Refresh token reuse detected. Please log in again.' });
    }

    // Rotate: invalidate old jti, issue new token pair with same fid but new jti
    const newJti = randomUUID();
    const accessToken = app.jwt.sign({ sub: userId });
    const refreshToken = app.jwt.sign({ sub: userId, fid, jti: newJti }, { expiresIn: '30d' });

    await redis.setex(refreshFamilyKey(fid), REFRESH_TTL_SECONDS, newJti);

    reply
      .setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })
      .send({ data: { access_token: accessToken } });
  });

  app.post('/logout', async (req, reply) => {
    const rawToken = req.cookies.refreshToken;
    if (rawToken) {
      try {
        const decoded = (await app.jwt.verify(rawToken)) as any;
        if (decoded?.fid) {
          await redis.del(refreshFamilyKey(decoded.fid));
        }
      } catch {
        // Token already invalid — still clear cookie
      }
    }

    reply.clearCookie('refreshToken').send({ message: 'Logged out' });
  });

  app.get('/me', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (req, reply) => {
    await req.jwtVerify();
    const user = await prisma.user.findUnique({
      where: { id: (req.user as any).sub },
    });

    if (!user) {
      return reply.status(404).send({ message: 'User not found' });
    }

    reply.send({
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        onboarding_completed: user.onboarding_completed,
        working_hours_start: user.working_hours_start,
        working_hours_end: user.working_hours_end,
        timezone: user.timezone,
        scoring_weights: {
          urgency: user.scoring_weight_urgency,
          priority: user.scoring_weight_priority,
          duration: user.scoring_weight_duration,
        },
      },
    });
  });
}
