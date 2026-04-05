import { buildApp } from '../src/app';

let app: any;

export default async (req: any, res: any) => {
  try {
    if (!app) {
      app = await buildApp();
      await app.ready();
    }

    // Strip /api prefix — Fastify routes use /auth, /users, etc. without /api
    if (req.url?.startsWith('/api')) {
      req.url = req.url.slice(4) || '/';
    }

    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('Vercel Function Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
  }
};
