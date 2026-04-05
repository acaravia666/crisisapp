import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { createReview, getReviewsByUser, hasReviewed } from '../db/queries/reviews';
import { getTransactionById } from '../db/queries/transactions';
import { recalcUserRating } from '../db/queries/users';
import { createNotificationsForUsers } from '../db/queries/notifications';

const createReviewSchema = z.object({
  transaction_id: z.string().uuid(),
  rating:         z.number().int().min(1).max(5),
  comment:        z.string().max(1000).optional(),
});

export default async function reviewRoutes(app: FastifyInstance) {

  // POST /reviews
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const reviewerId = request.user.sub;
    const parsed = createReviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const tx = await getTransactionById(parsed.data.transaction_id);
    if (!tx) return reply.code(404).send({ error: 'Transaction not found' });

    // Must be a party to the transaction
    if (tx.lender_id !== reviewerId && tx.borrower_id !== reviewerId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Must be completed
    if (tx.status !== 'completed') {
      return reply.code(409).send({ error: 'Can only review completed transactions' });
    }

    // Can't review twice
    const already = await hasReviewed(tx.id, reviewerId);
    if (already) return reply.code(409).send({ error: 'Already reviewed this transaction' });

    // The reviewed user is the other party
    const reviewedId = reviewerId === tx.lender_id ? tx.borrower_id : tx.lender_id;

    const review = await createReview({
      ...parsed.data,
      reviewer_id: reviewerId,
      reviewed_id: reviewedId,
    });

    // Recalculate avg rating
    await recalcUserRating(reviewedId);

    // Notify reviewed user
    await createNotificationsForUsers([reviewedId], {
      type:  'review_received',
      title: 'You received a new review',
      body:  `${parsed.data.rating} stars — ${parsed.data.comment?.slice(0, 60) ?? ''}`,
      data:  { review_id: review.id, screen: 'Profile' },
    });

    return reply.code(201).send({ review });
  });

  // GET /reviews/:userId
  app.get('/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const reviews = await getReviewsByUser(userId);
    return reply.send({ reviews });
  });
}
