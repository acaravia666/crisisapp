import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { createMessage, getMessagesByContext, markMessagesRead } from '../db/queries/messages';
import { createNotificationsForUsers } from '../db/queries/notifications';
import { io } from '../websocket/handlers';

const sendMessageSchema = z.object({
  transaction_id: z.string().uuid().optional(),
  request_id:     z.string().uuid().optional(),
  recipient_id:   z.string().uuid(),
  body:           z.string().min(1).max(2000),
}).refine(d => d.transaction_id || d.request_id, {
  message: 'Either transaction_id or request_id is required',
});

export default async function messageRoutes(app: FastifyInstance) {

  // POST /messages
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const senderId = request.user.sub;
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }

    const msg = await createMessage({ sender_id: senderId, ...parsed.data });

    // Real-time delivery via WebSocket
    const contextId = parsed.data.transaction_id ?? parsed.data.request_id!;
    io?.to(`chat:${contextId}`).emit('message', {
      id:           msg.id,
      sender_id:    msg.sender_id,
      recipient_id: msg.recipient_id,
      body:         msg.body,
      sent_at:      msg.sent_at,
    });

    // Push notification if recipient is offline
    await createNotificationsForUsers([parsed.data.recipient_id], {
      type:  'message',
      title: 'New message',
      body:  msg.body.slice(0, 80),
      data:  {
        context_id: contextId,
        sender_id:  senderId,
        screen:     'Chat',
      },
    });

    return reply.code(201).send({ message: msg });
  });

  // GET /messages/:contextId — thread for a transaction or request
  app.get('/:contextId', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { contextId } = request.params as { contextId: string };

    const messages = await getMessagesByContext(contextId, userId);
    return reply.send({ messages });
  });

  // POST /messages/:contextId/read
  app.post('/:contextId/read', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.sub;
    const { contextId } = request.params as { contextId: string };

    await markMessagesRead(contextId, userId);
    return reply.code(204).send();
  });
}
