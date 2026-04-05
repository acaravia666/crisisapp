import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../db/redis';
import { getRequestById } from '../db/queries/requests';
import { findMatches, getNotifyCount, getDeviceTokens } from '../services/matching';
import { notifyMatches, broadcastEmergency } from '../services/notifications';
import { QUEUES } from '../config/constants';

// ─── Queue (exported for use in routes) ──────────────────────────────────────

export const matchQueue = new Queue(QUEUES.MATCH, {
  connection: redis,
  defaultJobOptions: {
    attempts:   3,
    backoff:    { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50 },
  },
});

// ─── Worker (starts when this module is imported by the server) ──────────────

export function startMatchWorker() {
  const worker = new Worker(
    QUEUES.MATCH,
    async (job: Job<{ requestId: string }>) => {
      const { requestId } = job.data;

      const request = await getRequestById(requestId);
      if (!request || request.status !== 'open') {
        return; // Already fulfilled or cancelled
      }

      const candidates = await findMatches(request);
      if (candidates.length === 0) {
        console.log(`[match] No candidates found for request ${requestId}`);
        return;
      }

      const tokenMap = await getDeviceTokens(candidates.map(c => c.owner_id));

      if (request.urgency === 'emergency') {
        // Broadcast to all nearby matches
        await broadcastEmergency(request, candidates, tokenMap);
      } else {
        // Notify top N ranked matches
        const count = getNotifyCount(request.urgency);
        const top = candidates.slice(0, count);
        await notifyMatches(request, top, tokenMap);
      }

      console.log(
        `[match] request=${requestId} urgency=${request.urgency} ` +
        `candidates=${candidates.length} notified=${request.urgency === 'emergency' ? candidates.length : getNotifyCount(request.urgency)}`
      );
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[match] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
