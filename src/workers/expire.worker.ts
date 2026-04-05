import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../db/redis';
import { expireStaleRequests } from '../db/queries/requests';
import { createNotificationsForUsers } from '../db/queries/notifications';
import { pool } from '../db/pool';
import { QUEUES } from '../config/constants';

export const expireQueue = new Queue('expire-requests', {
  connection: redis,
});

export function startExpireWorker() {
  const worker = new Worker(
    'expire-requests',
    async (_job: Job) => {
      const expiredIds = await expireStaleRequests();

      if (expiredIds.length === 0) return;

      // Notify requesters their request expired
      for (const reqId of expiredIds) {
        const { rows } = await pool.query<{ requester_id: string }>(
          `SELECT requester_id FROM gear_requests WHERE id = $1`, [reqId]
        );
        if (rows[0]) {
          await createNotificationsForUsers([rows[0].requester_id], {
            type:  'request_expired',
            title: 'Your gear request expired',
            body:  'No one responded in time. You can repost it.',
            data:  { request_id: reqId },
          });
        }
      }

      console.log(`[expire] Expired ${expiredIds.length} requests`);
    },
    { connection: redis }
  );

  // Schedule the sweep to run every 5 minutes
  expireQueue.add('sweep', {}, {
    repeat: { every: 5 * 60 * 1000 },
  });

  worker.on('failed', (job, err) => {
    console.error(`[expire] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
