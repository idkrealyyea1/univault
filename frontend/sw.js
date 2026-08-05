// =====================================================================
// UniVault — Service worker (§20)
// Handles push notifications and notification clicks.
// =====================================================================

self.addEventListener('push', function (event) {
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'UniVault', body: event.data.text(), url: './' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
