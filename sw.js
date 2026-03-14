const CACHE_NAME = 'wassce-v3';
const ASSETS = ['index.html', 'manifest.json'];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Cache first, then network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('index.html'))
  );
});

// Handle alarm messages from main app
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'ALARM') {
    self.registration.showNotification('⏰ Study Time!', {
      body: e.data.label + ' — ' + e.data.time,
      icon: 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192">' +
        '<rect width="192" height="192" rx="40" fill="#7c3aed"/>' +
        '<text x="96" y="120" font-size="80" text-anchor="middle" fill="white">📚</text></svg>'
      ),
      badge: 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
        '<rect width="96" height="96" rx="20" fill="#7c3aed"/>' +
        '<text x="48" y="65" font-size="50" text-anchor="middle" fill="white">⏰</text></svg>'
      ),
      vibrate: [500, 200, 500, 200, 500],
      tag: 'wassce-alarm',
      renotify: true,
      requireInteraction: true,
      actions: [
        { action: 'snooze', title: '💤 Snooze' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ]
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'snooze') {
    // Snooze — re-notify in 10 minutes
    setTimeout(() => {
      self.registration.showNotification('⏰ Snooze Over!', {
        body: 'Time to get back to studying!',
        vibrate: [500, 200, 500],
        tag: 'wassce-snooze',
        requireInteraction: true
      });
    }, 10 * 60 * 1000);
  } else {
    // Open the app
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-alarms') {
    e.waitUntil(checkScheduledAlarms());
  }
});

async function checkScheduledAlarms() {
  // This runs periodically in the background
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const timeStr = h + ':' + m;
  const blockTimes = ['06:00', '09:00', '13:00', '16:00'];
  const labels = [
    'Block 1 — Start studying!',
    'Block 2 — Active learning!',
    'Block 3 — Practice time!',
    'Block 4 — Review session!'
  ];

  const idx = blockTimes.indexOf(timeStr);
  if (idx >= 0) {
    await self.registration.showNotification('⏰ ' + labels[idx], {
      body: 'Your study block is starting now!',
      vibrate: [500, 200, 500],
      tag: 'wassce-block-' + idx,
      requireInteraction: true
    });
  }
}
