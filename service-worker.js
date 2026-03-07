const CACHE_NAME = 'atlas-ledneva-v2';
const STATIC_CACHE_NAME = 'atlas-static-v2';
const IMAGES_CACHE_NAME = 'atlas-images-v2';
const DATA_CACHE_NAME = 'atlas-data-v2';

// Используем относительные пути! Начинаются с ./
const STATIC_URLS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME).then(cache => cache.addAll(STATIC_URLS)),
            caches.open(IMAGES_CACHE_NAME),
            caches.open(DATA_CACHE_NAME)
        ]).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(name => {
                        if (!name.includes('v1')) {
                            return caches.delete(name);
                        }
                    })
                );
            }),
            self.clients.claim()
        ])
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Для изображений из папки pictures - используем относительный путь
    if (url.pathname.includes('/pictures/')) {
        event.respondWith(
            caches.open(IMAGES_CACHE_NAME).then(cache =>
                cache.match(event.request).then(response => {
                    return response || fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => fetch(event.request))
            )
        );
        return;
    }
    
    // Для point.json - network-first
    if (url.pathname.endsWith('point.json')) {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                const responseClone = response.clone();
                caches.open(DATA_CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => caches.match(event.request))
        );
        return;
    }
    
    // Для остальных запросов - cache-first с относительными путями
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(networkResponse => {
                if (networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(STATIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Если всё упало, возвращаем заглушку или ничего
                return new Response('Offline', { status: 503 });
            });
        })
    );
});