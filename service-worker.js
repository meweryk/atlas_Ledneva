const CACHE_VERSION = 'v4.23'; // збільште при зміні статичних файлів!
const STATIC_CACHE_NAME = `atlas-static-${CACHE_VERSION}`;
const IMAGES_CACHE_NAME = `atlas-images-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `atlas-data-${CACHE_VERSION}`;

const FALLBACK_HTML = '/atlas_Ledneva/index.html';

// Статичні ресурси (абсолютні шляхи від кореня сайту)
const STATIC_URLS = [
    '/atlas_Ledneva/',
    '/atlas_Ledneva/index.html',
    '/atlas_Ledneva/css/style.css', 
    '/atlas_Ledneva/js/app.js',
    '/atlas_Ledneva/manifest.json',
    '/atlas_Ledneva/point.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

// INSTALL – кешуємо статику з детальним логуванням
self.addEventListener('install', event => {
    console.log('[SW Atlas] Install – початок кешування');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(cache => {
            console.log('[SW Atlas] Кешуємо:', STATIC_URLS);
            return cache.addAll(STATIC_URLS);
        }).then(() => {
            console.log('[SW Atlas] Усі статичні ресурси закешовано');
            return self.skipWaiting(); // активуємо одразу
        }).catch(err => {
            console.error('[SW Atlas] Помилка кешування:', err);
        })
    );
});

// ACTIVATE – видаляємо старі кеші та отримуємо контроль
self.addEventListener('activate', event => {
    console.log('[SW Atlas] Activate – видалення старих кешів');
    const currentCaches = [STATIC_CACHE_NAME, IMAGES_CACHE_NAME, DATA_CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!currentCaches.includes(cacheName)) {
                        console.log('[SW Atlas] Видаляємо старий кеш:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW Atlas] Старі кеші видалено, claim клієнтів');
            return self.clients.claim();
        })
    );
});

// FETCH – стратегії кешування з логуванням та fallback для навігації
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    console.log('[SW Atlas] Fetch:', event.request.method, url.pathname);
    
    // 1. Зображення з папки /pictures/ – cache-first
    if (url.pathname.includes('/pictures/')) {
        event.respondWith(
            caches.open(IMAGES_CACHE_NAME).then(cache =>
                cache.match(event.request).then(response => {
                    console.log('[SW Atlas] Зображення з кешу:', response ? 'знайдено' : 'не знайдено');
                    return response || fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => fetch(event.request))
            )
        );
        return;
    }
    
    // 2. Дані point.json – network-first з ігноруванням HTTP-кешу
    if (url.pathname.endsWith('point.json')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' })
            .then(response => {
                console.log('[SW Atlas] point.json отримано з мережі');
                const responseClone = response.clone();
                caches.open(DATA_CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                console.log('[SW Atlas] point.json – мережа недоступна, беру з кешу');
                return caches.match(event.request);
            })
        );
        return;
    }
    
    // 3. Інші запити (включаючи навігацію) – cache-first з фоновим оновленням і резервним fallback
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                console.log('[SW Atlas] Відповідь з кешу:', url.pathname);
                // Фонове оновлення (stale-while-revalidate)
                fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(STATIC_CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                            console.log('[SW Atlas] Оновлено кеш для:', url.pathname);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            
            // Якщо немає в кеші – пробуємо мережу
            console.log('[SW Atlas] Немає в кеші, запит до мережі:', url.pathname);
            return fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(STATIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Якщо мережа недоступна – повертаємо головну сторінку як fallback
                console.log('[SW Atlas] Мережа недоступна, повертаємо index.html з кешу');
                return caches.match(FALLBACK_HTML);
            });
        })
    );
});

// Повідомлення про версію (для налагодження)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});