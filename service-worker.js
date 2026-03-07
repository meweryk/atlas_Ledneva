const CACHE_NAME = 'atlas-ledneva-v1';
const STATIC_CACHE_NAME = 'atlas-static-v1';
const IMAGES_CACHE_NAME = 'atlas-images-v1';
const DATA_CACHE_NAME = 'atlas-data-v1';

// Ресурсы для предварительного кэширования
const STATIC_URLS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2'
];

// Установка и кэширование статики
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME).then(cache => cache.addAll(STATIC_URLS)),
            caches.open(IMAGES_CACHE_NAME),
            caches.open(DATA_CACHE_NAME)
        ]).then(() => self.skipWaiting())
    );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // Очищаем старые версии кэшей
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(name => {
                        if (!name.includes('v1') && name !== CACHE_NAME) {
                            return caches.delete(name);
                        }
                    })
                );
            }),
            // Захватываем контроль над всеми клиентами
            self.clients.claim()
        ])
    );
});

// Стратегия кэширования: cache-first для статики, network-first для данных
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Для изображений из папки pictures
    if (url.pathname.startsWith('/pictures/')) {
        event.respondWith(
            caches.open(IMAGES_CACHE_NAME).then(cache => 
                cache.match(event.request).then(response => {
                    return response || fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
            )
        );
        return;
    }

    // Для point.json - network-first с обновлением кэша
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

    // Для статики (css, js, html, bootstrap) - cache-first
    if (STATIC_URLS.includes(url.pathname) || 
        url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.js') || 
        url.pathname.endsWith('.html') ||
        url.hostname.includes('bootstrap')) {
        
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    // Кэшируем новые статические ресурсы
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Для всего остального - network-first
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
});

// Фоновая синхронизация для сохранения данных (опционально)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Здесь можно реализовать синхронизацию с сервером, если нужно
    console.log('Фоновая синхронизация данных');
}