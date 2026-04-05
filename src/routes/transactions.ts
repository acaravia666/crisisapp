import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import {
  createTransaction, getTransactionById, getTransactionByRequestId,
  getTransactionsByUser, updateTransactionStatus,
} from '../db/queries/transactions';
import { getGearById, updateGearStatus } from '../db/queries/gear';
import { updateRequestStatus } from '../db/queries/requests';
import { createNotificationsForUsers } from '../db/queries/notifications';

const createTransactionSchema = z.object({
  request_id:   z.string().uuid().optional(),
  gear_item_id: z.string().uuid(),
  borrower_id:  z.string().uuid(),
  type:         z.enum(['rental','loan','sale']),
  agreed_price: z.number().positive().optional(),
  notes:        z.string().max(500).optional(),
});

const statusSchema = z.object({
  status: z.enum(['active','completed','disputed','cancelled']),
});

export default async function transactionRoutes(app: FastifyInstance) {

  // POST /transactions — lender initiates (accepts a request)
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const lenderId = request.user.sub;
    const parsed = createTransactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const gear = await getGearById(parsed.data.gear_item_id);
    if (!gear)                      return reply.code(404).send({ error: 'Gear item not found' });
    if (gear.owner_id !== lenderId) return reply.code(403).send({ error: 'You do not own this item' });
    if (gear.status !== 'available') return reply.code(409).send({ error: 'Item is not available' });

    const tx = await createTransaction({ lender_id: lenderId, ...parsed.data });

    await updateGearStatus(gear.id, lenderId, 'lent_out');

    if (parsed.data.request_id) {
      await updateRequestStatus(parsed.data.request_id, 'matched', {
        fulfilled_by_id: lenderId,
        matched_gear_id: gear.id,
      });
    }

    await createNotificationsForUsers([parsed.data.borrower_id], {
      type:  'transaction_update',
      title: 'Your gear request was accepted!',
      body:  `${gear.name} is available — open the app to coordinate pickup.`,
      data:  { transaction_id: tx.id, screen: 'TransactionDetail' },
    });

    return reply.code(201).send({ transaction: tx });
  });

  // GET /transactions/mine
  app.get('/mine', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const transactions = await getTransactionsByUser(userId);
    return reply.send({ transactions });
  });

  // GET /transactions/request/:requestId
  app.get('/request/:requestId', { preHandler: authenticate }, async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    const tx = await getTransactionByRequestId(requestId);
    if (!tx) return reply.code(404).send({ error: 'No active transaction for this request' });
    return reply.send({ transaction: tx });
  });

  // GET /transactions/:id
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const tx = await getTransactionById(id);
    if (!tx) return reply.code(404).send({ error: 'Transaction not found' });
    if (tx.lender_id !== userId && tx.borrower_id !== userId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.send({ transaction: tx });
  });

  // PATCH /transactions/:id — update status
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const parsed = statusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const tx = await updateTransactionStatus(id, parsed.data.status, userId);
    if (!tx) return reply.code(404).send({ error: 'Transaction not found or forbidden' });

    if (parsed.data.status === 'completed' || parsed.data.status === 'cancelled') {
      await updateGearStatus(tx.gear_item_id, tx.lender_id, 'available');
      if (tx.request_id && parsed.data.status === 'completed') {
        await updateRequestStatus(tx.request_id, 'fulfilled');
      }
    }

    const otherPartyId = userId === tx.lender_id ? tx.borrower_id : tx.lender_id;
    await createNotificationsForUsers([otherPartyId], {
      type:  'transaction_update',
      title: `Transaction ${parsed.data.status}`,
      body:  `The gear transaction has been marked as ${parsed.data.status}.`,
      data:  { transaction_id: tx.id },
    });

    return reply.send({ transaction: tx });
  });
}
