// =====================================================
// PAE Barroblanco — Push Notification Service Worker
// Importado por el SW generado de Workbox (next-pwa)
// =====================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Sistema PAE', body: event.data.text() };
  }

  const title = data.title || 'Sistema PAE';
  const options = {
    body: data.body || 'Hay una nueva novedad en el horario escolar.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'pae-notification',
    renotify: true,
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
      // Si ya hay una ventana abierta, enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(urlToOpen);
          return;
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      return clients.openWindow(urlToOpen);
    })
  );
});
