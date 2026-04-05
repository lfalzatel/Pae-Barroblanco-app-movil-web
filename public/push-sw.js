// =====================================================
// PAE Barroblanco — Push Notification Service Worker
// =====================================================

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forzar activación inmediata
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Tomar control de las pestañas abiertas inmediatamente
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { 
      title: 'Sistema PAE', 
      body: event.data.text() || 'Hay una nueva novedad en el horario escolar.' 
    };
  }

  const title = data.title || 'Sistema PAE';
  const options = {
    body: data.body || 'Revisa los cambios en el horario del PAE.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200], // Patrón estándar y compatible
    tag: data.tag || 'pae-notification',
    renotify: true,
    requireInteraction: true, // La notificación no desaparece hasta que el usuario la toque
    data: {
      url: data.url || '/dashboard',
    },
    actions: [
      { action: 'open', title: 'Ver detalles' },
      { action: 'close', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
