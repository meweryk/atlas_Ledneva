const CACHE_NAME = 'atlas-ledneva-v2.8';
const STATIC_CACHE_NAME = 'atlas-static-v2.8';
const IMAGES_CACHE_NAME = 'atlas-images-v2.8';
const DATA_CACHE_NAME = 'atlas-data-v2.8';
const FALLBACK_HTML = '/atlas_Ledneva/index.html';
const FALLBACK_IMAGE = '/atlas_Ledneva/pictures/icon-192.png';
// Статические ресурсы (относительные пути!)
const STATIC_URLS = [
    '/atlas_Ledneva/',
    '/atlas_Ledneva/index.html',
    '/atlas_Ledneva/css/style.css',
    '/atlas_Ledneva/js/app.js',
    '/atlas_Ledneva/manifest.json',
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

// Активация – удаляем старые кэши (не совпадающие с текущими именами)
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
            self.clients.claim() // Немедленно захватываем контроль
        ])
    );
});

// Стратегии кэширования для разных типов запросов
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // 1. Изображения из папки pictures – cache-first с обновлением
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
    
    // 2. Данные point.json – network-first (всегда свежие)
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
    
    // 3. Все остальные запросы (статика) – cache-first, фоном обновляем
    event.respondWith(
        caches.match(event.request).then(response => {
            // Пытаемся получить свежую версию из сети (не блокируя ответ)
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
                .catch(error => {
                    console.log('Ошибка сети, используется кэш:', error);
                });
            
            // Возвращаем закэшированное, если есть, иначе ждём сеть
            return response || fetchPromise;
        })
    );
});