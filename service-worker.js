const CACHE_VERSION = 'v3.77'; // не забудьте увеличить версию!
const STATIC_CACHE_NAME = `atlas-static-${CACHE_VERSION}`;
const IMAGES_CACHE_NAME = `atlas-images-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `atlas-data-${CACHE_VERSION}`;
const FALLBACK_HTML = '/atlas_Ledneva/index.html';
const FALLBACK_IMAGE = '/atlas_Ledneva/pictures/icon-192.png';

// Статические ресурсы (относительные пути!)
const STATIC_URLS = [
    '/atlas_Ledneva/',
    '/atlas_Ledneva/index.html',
    '/atlas_Ledneva/css/style.css',
    '/atlas_Ledneva/js/app.js',
    '/atlas_Ledneva/manifest.json',
    "/atlas_Ledneva/point.json",
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

// Установка – кэшируем статику
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME).then(cache => cache.addAll(STATIC_URLS)),
            caches.open(IMAGES_CACHE_NAME),
            caches.open(DATA_CACHE_NAME)
        ]).then(() => self.skipWaiting())
    );
});

// Активация – удаляем старые кэши
self.addEventListener('activate', event => {
    const currentCaches = [STATIC_CACHE_NAME, IMAGES_CACHE_NAME, DATA_CACHE_NAME];
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (!currentCaches.includes(cacheName)) {
                            console.log('Удаление старого кэша:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim()
        ])
    );
});

// Стратегии кэширования
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // 1. Изображения из папки pictures – cache-first
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
    
    // 2. Данные point.json – network-first с игнорированием HTTP-кеша
    if (url.pathname.endsWith('point.json')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' }) // ← вот это добавлено
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
    
    // 3. Остальные запросы – cache-first с фоновым обновлением
    event.respondWith(
        caches.match(event.request).then(response => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {});
            return response || fetchPromise;
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});