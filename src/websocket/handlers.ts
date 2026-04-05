import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';

// Minimal in-process socket hub (no external dependency)
// For horizontal scaling, replace with @socket.io/redis-adapter

type EventMap = Record<string, unknown>;

class SocketHub {
  private rooms: Map<string, Set<WebSocket>> = new Map();
  private socketRooms: Map<WebSocket, Set<string>> = new Map();

  join(ws: WebSocket, room: string) {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set());
    this.rooms.get(room)!.add(ws);

    if (!this.socketRooms.has(ws)) this.socketRooms.set(ws, new Set());
    this.socketRooms.get(ws)!.add(room);
  }

  leave(ws: WebSocket, room: string) {
    this.rooms.get(room)?.delete(ws);
    this.socketRooms.get(ws)?.delete(room);
  }

  disconnect(ws: WebSocket) {
    const rooms = this.socketRooms.get(ws);
    if (rooms) {
      for (const room of rooms) {
        this.rooms.get(room)?.delete(ws);
      }
    }
    this.socketRooms.delete(ws);
  }

  to(room: string) {
    return {
      emit: (event: string, data: unknown) => {
        const members = this.rooms.get(room);
        if (!members) return;
        const payload = JSON.stringify({ event, data });
        for (const ws of members) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        }
      },
    };
  }

  emit(event: string, data: unknown) {
    const payload = JSON.stringify({ event, data });
    for (const [ws] of this.socketRooms) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

// Singleton hub — imported by services that need to broadcast
export let io: SocketHub | null = null;

export function registerWebSocket(app: FastifyInstance) {
  const hub = new SocketHub();
  io = hub;

  // /ws — main real-time channel
  app.get('/ws', { websocket: true }, (socket, request) => {
    // Auth: expect token in query string ?token=...
    const token = (request.query as Record<string, string>).token;

    let userId: string | null = null;

    try {
      const payload = app.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      socket.send(JSON.stringify({ event: 'error', data: { message: 'Unauthorized' } }));
      socket.close(1008, 'Unauthorized');
      return;
    }

    // Each user joins their personal room
    hub.join(socket, `user:${userId}`);

    socket.send(JSON.stringify({ event: 'connected', data: { userId } }));

    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as { event: string; data?: unknown };

        switch (msg.event) {
          // Join a chat room (transaction or request thread)
          case 'join_chat': {
            const { contextId } = msg.data as { contextId: string };
            hub.join(socket, `chat:${contextId}`);
            break;
          }

          // Leave a chat room
          case 'leave_chat': {
            const { contextId } = msg.data as { contextId: string };
            hub.leave(socket, `chat:${contextId}`);
            break;
          }

          // Ping/pong keepalive
          case 'ping':
            socket.send(JSON.stringify({ event: 'pong' }));
            break;

          default:
            break;
        }
      } catch {
        // Malformed message — ignore
      }
    });

    socket.on('close', () => {
      hub.disconnect(socket);
    });

    socket.on('error', () => {
      hub.disconnect(socket);
    });
  });
}
