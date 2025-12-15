const CACHE_NAME = 'haqpay-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/more.html',
  '/transfer.html',
  '/airtime.html',
  '/data.html',
  '/bills.html',
  '/card.html',
  '/reward.html',
  '/history.html',
  '/loan.html',
  '/finance.html'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'no-cache'})))
          .catch(err => {
            console.log('Cache addAll error:', err);
            // Continue even if some resources fail to cache
          });
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Check if valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
      .catch(() => {
        // Return offline page if available
        return caches.match('/index.html');
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from HaqPay',
    icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=HaqPay&backgroundColor=008037&size=192',
    badge: 'https://api.dicebear.com/7.x/identicon/svg?seed=HaqPay&backgroundColor=008037&size=96',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('HaqPay', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // Get pending transactions from IndexedDB or localStorage
  const pendingTransactions = JSON.parse(localStorage.getItem('pending_transactions') || '[]');
  
  for (const transaction of pendingTransactions) {
    try {
      // Attempt to send transaction
      await fetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Remove from pending if successful
      const index = pendingTransactions.indexOf(transaction);
      pendingTransactions.splice(index, 1);
      localStorage.setItem('pending_transactions', JSON.stringify(pendingTransactions));
    } catch (err) {
      console.log('Sync failed for transaction:', transaction);
    }
  }
}