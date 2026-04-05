import { env } from '../config/env';
import { createNotificationsForUsers } from '../db/queries/notifications';
import { GearRequest, NotificationType } from '../types';
import { MatchCandidate } from './matching';
import { io } from '../websocket/handlers';

// FCM is optional at MVP — log warnings if not configured
let sendFcmMulticast: ((tokens: string[], payload: FcmPayload) => Promise<void>) | null = null;

interface FcmPayload {
  title: string;
  body:  string;
  data:  Record<string, string>;
}

// Lazy-init FCM so the app still boots without Firebase credentials
async function getFcmSender() {
  if (sendFcmMulticast) return sendFcmMulticast;

  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    console.warn('[FCM] ❌ Firebase credentials not configured — push notifications disabled.');
    console.warn('[FCM]    Missing vars:', [
      !env.FCM_PROJECT_ID  ? 'FCM_PROJECT_ID'  : null,
      !env.FCM_CLIENT_EMAIL ? 'FCM_CLIENT_EMAIL' : null,
      !env.FCM_PRIVATE_KEY  ? 'FCM_PRIVATE_KEY'  : null,
    ].filter(Boolean).join(', '));
    sendFcmMulticast = async () => {};
    return sendFcmMulticast;
  }

  console.log('[FCM] Initializing Firebase Admin SDK…');
  console.log('[FCM]   project_id:   ', env.FCM_PROJECT_ID);
  console.log('[FCM]   client_email: ', env.FCM_CLIENT_EMAIL);
  console.log('[FCM]   private_key:  ', env.FCM_PRIVATE_KEY.slice(0, 40) + '…');

  try {
    // Dynamic import so missing creds don't crash startup
    const admin = await import('firebase-admin');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   env.FCM_PROJECT_ID,
          clientEmail: env.FCM_CLIENT_EMAIL,
          privateKey:  env.FCM_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      });
      console.log('[FCM] ✅ Firebase Admin initialized');
    } else {
      console.log('[FCM] Firebase Admin already initialized, reusing app');
    }

    const messaging = admin.messaging();

    sendFcmMulticast = async (tokens: string[], payload: FcmPayload) => {
      if (tokens.length === 0) {
        console.log('[FCM] No device tokens to send to — skipping push');
        return;
      }

      console.log(`[FCM] Sending "${payload.title}" to ${tokens.length} device(s)`);

      // FCM allows max 500 tokens per multicast
      const chunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += 500) {
        chunks.push(tokens.slice(i, i + 500));
      }

      const results = await Promise.all(chunks.map(chunk =>
        messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        })
      ));

      for (const r of results) {
        console.log(`[FCM] ✅ Success: ${r.successCount}  ❌ Failed: ${r.failureCount}`);
        if (r.failureCount > 0) {
          r.responses.forEach((resp, i) => {
            if (!resp.success) console.error(`[FCM]   token[${i}] error:`, resp.error?.message);
          });
        }
      }
    };
  } catch (err) {
    console.error('[FCM] ❌ Initialization error:', err);
    sendFcmMulticast = async () => {};
  }

  return sendFcmMulticast!;
}

// ─── Notify ranked matches (normal / soon / urgent) ────────────────────────────

export async function notifyMatches(
  request: GearRequest,
  matches: MatchCandidate[],
  tokenMap: Record<string, string>
): Promise<void> {
  if (matches.length === 0) return;

  const type: NotificationType = 'new_match';
  const title = 'Someone needs your gear nearby';
  const body  = `"${request.equipment}" needed • ${distanceLabel(matches[0].distance_m)}`;

  const userIds = matches.map(m => m.owner_id);

  await createNotificationsForUsers(userIds, { type, title, body,
    data: { request_id: request.id, screen: 'RequestDetail' },
    sent_via_push: true,
  });

  const tokens = userIds.map(uid => tokenMap[uid]).filter(Boolean) as string[];
  const fcm = await getFcmSender();
  await fcm(tokens, { title, body, data: { request_id: request.id } });

  // WebSocket: emit to each owner's room
  for (const match of matches) {
    io?.to(`user:${match.owner_id}`).emit('new_match', {
      requestId:  request.id,
      equipment:  request.equipment,
      urgency:    request.urgency,
      distanceM:  match.distance_m,
      gearId:     match.gear_id,
    });
  }
}

// ─── Emergency broadcast ────────────────────────────────────────────────────────

export async function broadcastEmergency(
  request: GearRequest,
  matches: MatchCandidate[],
  tokenMap: Record<string, string>
): Promise<void> {
  if (matches.length === 0) return;

  const type: NotificationType = 'emergency_broadcast';
  const title = 'EMERGENCY gear request nearby';
  const body  = `${request.equipment} needed NOW — show starting!`;

  const userIds = matches.map(m => m.owner_id);

  await createNotificationsForUsers(userIds, { type, title, body,
    data: { request_id: request.id, screen: 'RequestDetail', emergency: 'true' },
    sent_via_push: true,
  });

  const tokens = userIds.map(uid => tokenMap[uid]).filter(Boolean) as string[];
  const fcm = await getFcmSender();
  await fcm(tokens, {
    title,
    body,
    data: { request_id: request.id, emergency: 'true' },
  });

  // WebSocket: broadcast to all users in nearby channel
  io?.emit('emergency', {
    requestId:  request.id,
    equipment:  request.equipment,
    urgency:    'emergency',
    ownerIds:   userIds,
  });
}

function distanceLabel(distM: number): string {
  if (distM < 1000) return `${Math.round(distM)}m away`;
  return `${(distM / 1000).toFixed(1)}km away`;
}
