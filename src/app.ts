import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from './config/env';
import { redis } from './db/redis';

const UPLOADS_DIR = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create uploads dir (Expected on Vercel):', err);
  }
}

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import gearRoutes from './routes/gear';
import requestRoutes from './routes/requests';
import transactionRoutes from './routes/transactions';
import messageRoutes from './routes/messages';
import reviewRoutes from './routes/reviews';

// WebSocket
import { registerWebSocket } from './websocket/handlers';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // ─── Plugins ────────────────────────────────────────────────────────────────

  // Manual CORS — @fastify/cors v11 + Fastify v5 compatibility
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin ?? '*';
    reply.header('Access-Control-Allow-Origin',      origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods',     'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers',     'Content-Type,Authorization');

    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB max

  ensureUploadsDir();
  await app.register(fastifyStatic, {
    root:       UPLOADS_DIR,
    prefix:     '/uploads/',
    decorateReply: false,
  });

  if (env.REDIS_URL && env.REDIS_URL !== 'redis://localhost:6379') {
    try {
      await app.register(fastifyRateLimit, {
        global: true,
        max: 200,
        timeWindow: '1 minute',
        redis,
      });
    } catch (err) {
      console.warn('Could not register Redis rate limit (Possible connection error):', err);
    }
  } else {
    // Basic in-memory rate limit as fallback
    await app.register(fastifyRateLimit, {
      global: true,
      max: 100,
      timeWindow: '1 minute',
    });
  }

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign:   { expiresIn: env.JWT_EXPIRES_IN },
  });

  await app.register(fastifyWebsocket);

  // ─── Auth decorator ──────────────────────────────────────────────────────────

  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // ─── Routes ─────────────────────────────────────────────────────────────────

  await app.register(authRoutes,        { prefix: '/auth' });
  await app.register(userRoutes,        { prefix: '/users' });
  await app.register(gearRoutes,        { prefix: '/gear' });
  await app.register(requestRoutes,     { prefix: '/requests' });
  await app.register(transactionRoutes, { prefix: '/transactions' });
  await app.register(messageRoutes,     { prefix: '/messages' });
  await app.register(reviewRoutes,      { prefix: '/reviews' });

  // ─── WebSocket ───────────────────────────────────────────────────────────────

  registerWebSocket(app);

  // ─── Upload ──────────────────────────────────────────────────────────────────

  app.post('/uploads', { preHandler: (app as any).authenticate }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'No file provided' });

    const ext      = path.extname(file.filename).toLowerCase() || '.jpg';
    const allowed  = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
    if (!allowed.includes(ext)) {
      return reply.code(400).send({ error: 'Only jpg, png, webp or heic allowed' });
    }

    const filename = `${randomUUID()}${ext}`;
    const dest     = path.join(UPLOADS_DIR, filename);


    await pipeline(file.file, fs.createWriteStream(dest));

    const baseUrl = `${request.protocol}://${request.hostname}:${env.PORT}`;
    return reply.code(201).send({ url: `${baseUrl}/uploads/${filename}` });
  });

  // ─── Health check ────────────────────────────────────────────────────────────

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  return app;
}
