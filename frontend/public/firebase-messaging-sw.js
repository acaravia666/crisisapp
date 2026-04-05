importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCWSVdVQCYB2LVHiigpJNt0eMOc7QYb7jY',
  authDomain:        'crisisapp-web.firebaseapp.com',
  projectId:         'crisisapp-web',
  storageBucket:     'crisisapp-web.firebasestorage.app',
  messagingSenderId: '65356185678',
  appId:             '1:65356185678:web:fc2ae1ae02521b067d031f',
});

const messaging = firebase.messaging();

// Background messages (app closed or minimized)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Pulse';
  const body  = payload.notification?.body  ?? '';
  const data  = payload.data ?? {};

  self.registration.showNotification(title, {
    body,
    icon:  '/favicon.svg',
    badge: '/favicon.svg',
    data,
    vibrate: [200, 100, 200],
  });
});

// Tap on notification → open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
