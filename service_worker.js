const CACHE_NAME = '3010250100';
const STATIC_CACHE = `youdai-static-${CACHE_NAME}`;
const DYNAMIC_CACHE = `youdai-dynamic-${CACHE_NAME}`;

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/player.html',
  '/stream.html',
  '/videos.json',
  '/manifest.json',
  '/dev.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('Cache install failed:', err))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => 
              cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE
            )
            .map(cacheName => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/')
        .then(response => response || fetch(request))
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone response before caching
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Handle image requests with cache-first strategy
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) return response;
          
          return fetch(request)
            .then(response => {
              // Only cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE)
                  .then(cache => cache.put(request, responseClone))
                  .catch(err => console.warn('Failed to cache image:', err));
              }
              return response;
            })
            .catch(() => {
              // Return fallback image on network failure
              return new Response(
                `<svg width="240" height="180" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#333"/>
                  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#999" text-anchor="middle" dy=".3em">No Image</text>
                </svg>`,
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            });
        })
    );
    return;
  }

  // Handle other requests with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) return response;
        
        return fetch(request)
          .then(response => {
            // Only cache successful responses from same origin or CDN
            if (response.status === 200 && 
                (url.origin === location.origin || 
                 url.origin === 'https://cdnjs.cloudflare.com')) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(request, responseClone))
                .catch(err => console.warn('Failed to cache resource:', err));
            }
            return response;
          });
      })
      .catch(err => {
        console.error('Fetch failed:', err);
        throw err;
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    // Handle any background sync logic here
  }
});

// Push notifications (optional)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New content available!',
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [200, 100, 200],
      data: data.url || '/',
      actions: [
        {
          action: 'open',
          title: 'View',
          icon: '/icon-48.png'
        },
        {
          action: 'close',
          title: 'Dismiss'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'YouDai', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});