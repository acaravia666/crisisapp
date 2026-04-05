import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            'AIzaSyCWSVdVQCYB2LVHiigpJNt0eMOc7QYb7jY',
  authDomain:        'crisisapp-web.firebaseapp.com',
  projectId:         'crisisapp-web',
  storageBucket:     'crisisapp-web.firebasestorage.app',
  messagingSenderId: '65356185678',
  appId:             '1:65356185678:web:fc2ae1ae02521b067d031f',
  measurementId:     'G-3CXL9SFV7P',
};

const VAPID_KEY = 'BLUQaILOSixZRTo0Ai_ynSvKLG6vLBkQtBBD53zE0_rIEKGfoUU3qDzfpIXqqtdGv7BuI8aqCrlGTKnhFyd-IJ0';

const app       = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey:          VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });

    return token || null;
  } catch (err) {
    console.error('[FCM] Could not get token:', err);
    return null;
  }
}

// Handle foreground messages (app is open)
export function listenForegroundMessages(
  onNotification: (title: string, body: string, data: Record<string, string>) => void
) {
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'Pulse';
    const body  = payload.notification?.body  ?? '';
    const data  = (payload.data ?? {}) as Record<string, string>;
    onNotification(title, body, data);
  });
}
