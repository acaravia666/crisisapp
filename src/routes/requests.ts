import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import {
  createRequest, getRequestById, getOpenRequestsByUser,
  getNearbyRequests, updateRequestStatus,
} from '../db/queries/requests';
import { parseGearRequest } from '../services/ai-parser';
import { findMatches, getNotifyCount, getDeviceTokens } from '../services/matching';
import { notifyMatches, broadcastEmergency } from '../services/notifications';
import { env } from '../config/env';

async function triggerMatching(req: Awaited<ReturnType<typeof createRequest>>) {
  try {
    // createRequest returns lat/lng as top-level fields; findMatches expects req.location
    const reqWithLocation = {
      ...req,
      location: { lat: (req as any).lat, lng: (req as any).lng },
    };
    console.log(`[matching] Request ${req.id} — "${req.equipment}" (${req.urgency}) at (${(req as any).lat},${(req as any).lng})`);
    const matches = await findMatches(reqWithLocation as any);
    console.log(`[matching] Found ${matches.length} candidate(s)`);

    const topN = matches.slice(0, getNotifyCount(req.urgency));
    if (!topN.length) {
      console.log('[matching] No candidates to notify — done');
      return;
    }

    const tokenMap = await getDeviceTokens(topN.map(m => m.owner_id));
    console.log(`[matching] Device tokens fetched for ${Object.keys(tokenMap).length}/${topN.length} owner(s)`);

    if (req.urgency === 'emergency') {
      await broadcastEmergency(req as any, topN, tokenMap);
    } else {
      await notifyMatches(req as any, topN, tokenMap);
    }
  } catch (err) {
    console.error('[matching] Error during match notification:', err);
  }
}

const gearCategoryEnum = z.enum([
  'cables','microphones','speakers','stands','pedals',
  'instruments','lighting','dj_gear','power','adapters','accessories',
]);

const structuredRequestSchema = z.object({
  equipment: z.string().min(2).max(200),
  category:  gearCategoryEnum.optional(),
  quantity:  z.number().int().positive().default(1),
  urgency:   z.enum(['normal','soon','urgent','emergency']).default('normal'),
  action:    z.enum(['rent','lend','sell']).default('lend'),
  lat:       z.number().min(-90).max(90),
  lng:       z.number().min(-180).max(180),
  search_radius_km: z.number().positive().max(50).default(5),
  notes:     z.string().max(500).optional(),
});

const naturalRequestSchema = z.object({
  raw_text:  z.string().min(3).max(500),
  lat:       z.number().min(-90).max(90),
  lng:       z.number().min(-180).max(180),
  search_radius_km: z.number().positive().max(50).default(5),
  urgency:   z.enum(['normal','soon','urgent','emergency']).optional(),
  action:    z.enum(['rent','lend','sell']).optional(),
});

const nearbyQuerySchema = z.object({
  lat:    z.string().transform(Number),
  lng:    z.string().transform(Number),
  radius: z.string().transform(Number).optional(),
  limit:  z.string().transform(Number).optional(),
});

export default async function requestRoutes(app: FastifyInstance) {

  // POST /requests — structured request (no BullMQ on Vercel)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const parsed = structuredRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const req = await createRequest({ requester_id: userId, ...parsed.data });
    triggerMatching(req); // fire-and-forget, don't block the response
    return reply.code(201).send({ request: req });
  });

  // POST /requests/parse — AI parses, then creates (no BullMQ on Vercel)
  app.post('/parse', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const parsed = naturalRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { raw_text, lat, lng, search_radius_km, urgency: urgencyOverride, action: actionOverride } = parsed.data;

    const aiResult = await parseGearRequest(raw_text);

    const req = await createRequest({
      requester_id:  userId,
      equipment:     aiResult.equipment,
      category:      aiResult.category,
      quantity:      aiResult.quantity,
      urgency:       urgencyOverride ?? aiResult.urgency,
      action:        actionOverride  ?? aiResult.action,
      lat,
      lng,
      search_radius_km,
      raw_text,
      ai_confidence: aiResult.confidence,
      notes:         aiResult.notes,
    });

    triggerMatching(req); // fire-and-forget
    return reply.code(201).send({ request: req, ai_parse: aiResult });
  });

  // GET /requests/nearby
  app.get('/nearby', { preHandler: authenticate }, async (request, reply) => {
    const parsed = nearbyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const { lat, lng, radius, limit } = parsed.data;
    const radiusKm = Math.min(radius ?? env.DEFAULT_SEARCH_RADIUS_KM, env.MAX_SEARCH_RADIUS_KM);
    const requests = await getNearbyRequests({ lat, lng, radiusKm, limit });
    return reply.send({ requests });
  });

  // GET /requests/mine
  app.get('/mine', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const requests = await getOpenRequestsByUser(userId);
    return reply.send({ requests });
  });

  // GET /requests/:id — includes requester name for UI
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const req = await getRequestById(id);
    if (!req) return reply.code(404).send({ error: 'Request not found' });

    const { pool } = await import('../db/pool');
    const { rows } = await pool.query(`SELECT name FROM users WHERE id = $1`, [req.requester_id]);
    return reply.send({ request: { ...req, users: rows[0] ?? { name: 'Unknown' } } });
  });

  // PATCH /requests/:id/fulfill
  app.patch('/:id/fulfill', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const req = await getRequestById(id);
    if (!req) return reply.code(404).send({ error: 'Not found' });
    if (req.status !== 'open' && req.status !== 'matched') {
      return reply.code(409).send({ error: `Cannot fulfill a ${req.status} request` });
    }

    await updateRequestStatus(id, 'fulfilled', { fulfilled_by_id: userId });
    return reply.code(204).send();
  });

  // PATCH /requests/:id/cancel
  app.patch('/:id/cancel', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const req = await getRequestById(id);
    if (!req)                        return reply.code(404).send({ error: 'Not found' });
    if (req.requester_id !== userId) return reply.code(403).send({ error: 'Forbidden' });
    if (req.status !== 'open')       return reply.code(409).send({ error: `Cannot cancel a ${req.status} request` });

    await updateRequestStatus(id, 'cancelled');
    return reply.code(204).send();
  });
}
