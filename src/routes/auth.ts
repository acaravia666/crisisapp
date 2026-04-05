import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { createUser, findUserByEmail } from '../db/queries/users';
import { env } from '../config/env';

const registerSchema = z.object({
  name:     z.string().min(2).max(80),
  email:    z.email(),
  password: z.string().min(8),
  phone:    z.string().optional(),
});

const loginSchema = z.object({
  email:    z.email(),
  password: z.string().min(1),
});

function signRefreshToken(sub: string, email: string): string {
  return jwt.sign(
    { sub, email, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

function verifyRefreshToken(token: string): { sub: string; email: string } {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
    sub: string; email: string; type: string;
  };
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return { sub: payload.sub, email: payload.email };
}

export default async function authRoutes(app: FastifyInstance) {

  // POST /auth/register
  app.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { name, email, password, phone } = parsed.data;

    const existing = await findUserByEmail(email);
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await createUser({ name, email, password_hash, phone });

    const accessToken  = app.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken(user.id, user.email);

    return reply.code(201).send({ user, accessToken, refreshToken });
  });

  // POST /auth/login
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const { password_hash: _, ...safeUser } = user;

    const accessToken  = app.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken(user.id, user.email);

    return reply.send({ user: safeUser, accessToken, refreshToken });
  });

  // POST /auth/refresh
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) {
      return reply.code(400).send({ error: 'refreshToken required' });
    }

    try {
      const { sub, email } = verifyRefreshToken(refreshToken);
      const accessToken    = app.jwt.sign({ sub, email });
      const newRefresh     = signRefreshToken(sub, email);
      return reply.send({ accessToken, refreshToken: newRefresh });
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
  });
}
