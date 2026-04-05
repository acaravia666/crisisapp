import { buildApp } from './app';
import { env } from './config/env';
import { pool } from './db/pool';
import { redis } from './db/redis';
import { startMatchWorker } from './workers/match.worker';
import { startExpireWorker } from './workers/expire.worker';

async function main() {
  const app = await buildApp();

  // Start background workers
  const matchWorker  = startMatchWorker();
  const expireWorker = startExpireWorker();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    await pool.end();
    await redis.quit();
    process.exit(1);
  }

  const shutdown = async () => {
    app.log.info('Shutting down...');
    await app.close();
    await matchWorker.close();
    await expireWorker.close();
    await pool.end();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

main();
