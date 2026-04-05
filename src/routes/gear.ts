import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import {
  createGearItem, getGearByOwner, getGearById,
  updateGearItem, updateGearStatus, deleteGearItem, getNearbyGear,
} from '../db/queries/gear';
import { GEAR_CATEGORIES } from '../config/constants';
import { env } from '../config/env';

const gearCategoryEnum = z.enum([
  'cables','microphones','speakers','stands','pedals',
  'instruments','lighting','dj_gear','power','adapters','accessories'
]);

const createGearSchema = z.object({
  name:        z.string().min(2).max(120),
  category:    gearCategoryEnum,
  description: z.string().max(1000).optional(),
  brand:       z.string().max(80).optional(),
  model:       z.string().max(80).optional(),
  photo_urls:  z.array(z.string()).max(10).optional(),
  can_rent:    z.boolean().optional(),
  can_lend:    z.boolean().optional(),
  can_sell:    z.boolean().optional(),
  rent_price:  z.number().positive().optional(),
  sell_price:  z.number().positive().optional(),
  condition:   z.enum(['mint','good','fair','worn']).optional(),
  tags:        z.array(z.string().max(40)).max(20).optional(),
});

const nearbyQuerySchema = z.object({
  lat:      z.string().transform(Number),
  lng:      z.string().transform(Number),
  radius:   z.string().transform(Number).optional(),
  category: gearCategoryEnum.optional(),
  action:   z.enum(['rent','lend','sell']).optional(),
  limit:    z.string().transform(Number).optional(),
});

export default async function gearRoutes(app: FastifyInstance) {

  // POST /gear
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const parsed = createGearSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const item = await createGearItem({ owner_id: userId, ...parsed.data });
    return reply.code(201).send({ item });
  });

  // GET /gear/mine
  app.get('/mine', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const items = await getGearByOwner(userId);
    return reply.send({ items });
  });

  // GET /gear/nearby
  app.get('/nearby', { preHandler: authenticate }, async (request, reply) => {
    const parsed = nearbyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { lat, lng, radius, category, action, limit } = parsed.data;
    const radiusKm = Math.min(radius ?? env.DEFAULT_SEARCH_RADIUS_KM, env.MAX_SEARCH_RADIUS_KM);

    const items = await getNearbyGear({ lat, lng, radiusKm, category, action, limit });
    return reply.send({ items });
  });

  // GET /gear/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await getGearById(id);
    if (!item) return reply.code(404).send({ error: 'Gear item not found' });
    return reply.send({ item });
  });

  // PATCH /gear/:id
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const parsed = createGearSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const item = await updateGearItem(id, userId, parsed.data as any);
    if (!item) return reply.code(404).send({ error: 'Gear item not found or not yours' });
    return reply.send({ item });
  });

  // PATCH /gear/:id/status
  app.patch('/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };

    if (!['available','lent_out','unavailable'].includes(status ?? '')) {
      return reply.code(400).send({ error: 'Invalid status' });
    }

    const item = await updateGearStatus(id, userId, status as any);
    if (!item) return reply.code(404).send({ error: 'Gear item not found or not yours' });
    return reply.send({ item });
  });

  // DELETE /gear/:id
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const deleted = await deleteGearItem(id, userId);
    if (!deleted) return reply.code(404).send({ error: 'Gear item not found or not yours' });
    return reply.code(204).send();
  });
}
