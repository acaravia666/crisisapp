import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import {
  findUserById, updateUser, updateUserLocation,
  updateFcmToken,
} from '../db/queries/users';
import { getNotificationsForUser, markNotificationsRead } from '../db/queries/notifications';
import { env } from '../config/env';
import { redis } from '../db/redis';
import { REDIS_KEYS } from '../config/constants';

const updateProfileSchema = z.object({
  name:       z.string().min(2).max(80).optional(),
  phone:      z.string().optional(),
  bio:        z.string().max(500).optional(),
  avatar_url: z.url().optional(),
});

const locationSchema = z.object({
  lat:        z.number().min(-90).max(90),
  lng:        z.number().min(-180).max(180),
  accuracy_m: z.number().positive().optional(),
});

export default async function userRoutes(app: FastifyInstance) {

  // GET /users/me — own profile
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const user = await findUserById(userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const { password_hash: _, ...safeUser } = user as any;
    return reply.send({ user: safeUser });
  });

  // GET /users/:id — public profile
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await findUserById(id);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send({ user });
  });

  // PATCH /users/me
  app.patch('/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const user = await updateUser(userId, parsed.data);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send({ user });
  });

  // POST /users/me/location
  app.post('/me/location', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const parsed = locationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { lat, lng, accuracy_m } = parsed.data;

    await updateUserLocation(userId, lat, lng, accuracy_m);

    // Mirror to Redis GEO for hot-path matching
    await redis.geoadd(REDIS_KEYS.USER_LOCATION, lng, lat, userId);

    return reply.code(204).send();
  });

  // POST /users/me/fcm-token
  app.post('/me/fcm-token', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { token } = request.body as { token?: string };
    if (!token) return reply.code(400).send({ error: 'token required' });

    await updateFcmToken(userId, token);

    // Also cache in Redis for fast lookup during broadcasts
    await redis.set(REDIS_KEYS.USER_FCM_TOKEN(userId), token, 'EX', 60 * 60 * 24 * 30);

    return reply.code(204).send();
  });

  // GET /users/me/notifications
  app.get('/me/notifications', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { limit = '50', offset = '0' } = request.query as Record<string, string>;

    const notifications = await getNotificationsForUser(
      userId,
      Math.min(parseInt(limit, 10), 100),
      parseInt(offset, 10)
    );

    return reply.send({ notifications });
  });

  // POST /users/me/notifications/read
  app.post('/me/notifications/read', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    await markNotificationsRead(userId);
    return reply.code(204).send();
  });
}
