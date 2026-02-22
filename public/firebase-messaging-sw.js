// Firebase Messaging Service Worker
// This runs in the background even when the browser/tab is closed

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase config (same as your app)
firebase.initializeApp({
  apiKey: "AIzaSyAJnYbO8Gj7kxvVup38OMkU4Ij5SYE1vMQ",
  authDomain: "sanjaya-567d3.firebaseapp.com",
  databaseURL: "https://sanjaya-567d3-default-rtdb.firebaseio.com",
  projectId: "sanjaya-567d3",
  storageBucket: "sanjaya-567d3.firebasestorage.app",
  messagingSenderId: "949733148132",
  appId: "1:949733148132:web:03066fca97c32bfbdaf3f1",
  measurementId: "G-J3MFTYRZWP"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'CRITICAL: FALL DETECTED!';
  const notificationOptions = {
    body: (payload.notification?.body || 'Immediate attention required!') + '\nTap Acknowledge to stop alarm.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'fall-alert',
    requireInteraction: true, // Keeps notification securely visible until user clicks
    vibrate: [1000, 100, 1000, 100, 1000, 100, 1000, 100, 1000, 100, 1000, 100], // 12+ seconds of aggressive fast vibration pattern
    actions: [
      { action: 'open', title: 'Open Dashboard' },
      { action: 'acknowledge', title: 'Acknowledge' }
    ],
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  if (event.action === 'acknowledge') {
    // Could send a message back to the app
    console.log('[SW] Alert acknowledged');
  } else {
    // Open the dashboard
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If dashboard is already open, focus it
        for (const client of clientList) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/dashboard');
        }
      })
    );
  }
});
