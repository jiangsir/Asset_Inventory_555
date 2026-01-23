/**
 * 財產盤點系統 555 - Service Worker
 * 支持離線功能和應用緩存
 */

const CACHE_NAME = 'asset_inventory_v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/data-manager.js',
  '/js/sheet-api.js',
  '/js/ui.js',
  '/js/barcode-scanner.js',
  '/manifest.json'
];

// Service Worker 安裝事件
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安裝中...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 快取資源中...');
      return cache.addAll(ASSETS_TO_CACHE).catch((error) => {
        console.warn('[Service Worker] 某些資源快取失敗:', error);
        // 即使某些資源失敗，仍然繼續
      });
    })
  );

  // 跳過等待狀態，立即激活
  self.skipWaiting();
});

// Service Worker 激活事件
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活中...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 刪除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Service Worker fetch 事件 - 網絡優先策略
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 忽略非 GET 請求
  if (request.method !== 'GET') {
    return;
  }

  // 對 API 請求使用網絡優先策略
  if (request.url.includes('script.google.com') || request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 如果成功，更新快取
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 網絡失敗，嘗試從快取獲取
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            // 返回離線頁面（可選）
            return new Response(
              '離線模式：無法連接到伺服器。請檢查網絡連接。',
              { status: 503, statusText: '服務不可用' }
            );
          });
        })
    );
  } else {
    // 其他資源使用快取優先策略
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request)
            .then((response) => {
              // 如果是成功的響應，更新快取
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseToCache);
                });
              }
              return response;
            })
            .catch(() => {
              // 返回離線回退
              return new Response(
                '無法加載資源。請檢查網絡連接。',
                { status: 503 }
              );
            })
        );
      })
    );
  }
});

// 處理後台同步（可選）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-assets') {
    event.waitUntil(syncAssets());
  }
});

/**
 * 後台同步資產數據
 */
async function syncAssets() {
  try {
    // 從 IndexedDB 獲取待同步數據
    // 然後發送到伺服器
    console.log('[Service Worker] 執行後台同步...');
  } catch (error) {
    console.error('[Service Worker] 後台同步失敗:', error);
    throw error;
  }
}

// 推送通知（可選）
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '財產盤點提醒',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><text x="50%" y="50%" font-size="120" text-anchor="middle" dominant-baseline="central">📦</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><text x="50%" y="50%" font-size="45" text-anchor="middle" dominant-baseline="central">📦</text></svg>',
    tag: 'asset-inventory-notification'
  };

  event.waitUntil(self.registration.showNotification('財產盤點系統', options));
});

// 點擊通知
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 查找是否已有打開的窗口
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // 如果沒有，打開新窗口
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

console.log('[Service Worker] 已加載');
