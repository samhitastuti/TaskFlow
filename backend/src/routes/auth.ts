import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { loginSchema, registerSchema } from '../schemas/auth';
import { ZodError } from 'zod';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const data = registerSchema.parse(req.body);
    
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
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
      }
    });

    const accessToken = app.jwt.sign({ sub: user.id });
    const refreshToken = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' });

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
            onboarding_completed: user.onboarding_completed
          }
        }
      });
  });

  app.post('/login', async (req, reply) => {
    const { email, password } = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ message: 'Invalid credentials' });
    }

    const accessToken = app.jwt.sign({ sub: user.id });
    const refreshToken = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' });

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
            onboarding_completed: user.onboarding_completed
          }
        }
      });
  });

  app.post('/refresh', async (req, reply) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({ message: 'No refresh token' });
    }

    try {
      const decoded = await app.jwt.verify(refreshToken) as { sub: string };
      const accessToken = app.jwt.sign({ sub: decoded.sub });
      
      reply.send({
        data: {
          access_token: accessToken
        }
      });
    } catch (err) {
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }
  });

  app.post('/logout', async (req, reply) => {
    reply
      .clearCookie('refreshToken')
      .send({ message: 'Logged out' });
  });

  app.get('/me', async (req, reply) => {
    await req.jwtVerify();
    const user = await prisma.user.findUnique({
      where: { id: (req.user as any).sub }
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
          duration: user.scoring_weight_duration
        }
      }
    });
  });
}
