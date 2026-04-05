import { buildApp } from '../src/app';

export default async (req: any, res: any) => {
  try {
    const app = await buildApp();
    await app.ready();
    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('Vercel Function Error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ 
      error: 'Internal Server Error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }));
  }
};
