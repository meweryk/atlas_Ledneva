// =============================================================
//  Service Worker для Атласа Леднёва
//  Версия: v5.00 — переход на относительные пути + локальный vendor.
//  Деплой: GitHub Pages (любая подпапка, имя репозитория не важно).
// =============================================================

const CACHE_VERSION = 'v5.00';
const STATIC_CACHE_NAME = `atlas-static-${CACHE_VERSION}`;
const IMAGES_CACHE_NAME = `atlas-images-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `atlas-data-${CACHE_VERSION}`;

// Базовый URL = папка, где лежит service-worker.js.
// Всё, что под ним, будет закешировано корректно, независимо от имени репозитория.
const BASE_URL = new URL('./', self.location);

// Fallback для навигации, если страница не в кеше.
// Через `new URL` получаем корректный путь от BASE_URL.
const FALLBACK_HTML = new URL('./index.html', BASE_URL).pathname;

// ---------- Список статических ресурсов ----------
// ВАЖНО: имена файлов должны точно совпадать по регистру
// с файлами в репозитории (GitHub Pages — Linux, регистр критичен).
const STATIC_URLS = [
    './',
    './index.html',
    './LUXE METALLICS.html', // пробел в имени — оставлен как есть
    './manifest.json',
    './point.json',
    './nozod.json',
    
    // JS и CSS приложения
    './css/style.css',
    './js/app.js',
    './js/star.js',
    './js/nozod.js',
    
    // Bootstrap (локально)
    './vendor/bootstrap.min.css',
    './vendor/bootstrap.bundle.min.js',
    './vendor/bootstrap-icons.min.css',
    './vendor/fonts/bootstrap-icons.woff',
    './vendor/fonts/bootstrap-icons.woff2',
    
    // Tailwind (локально собранный)
    './vendor/tailwind.css',
    
    // Иконки PWA
    './pictures/icon-192.png'
];

// ---------- INSTALL ----------
// Кешируем по одному файлу, чтобы один 404 не сломал всю установку.
// (Важно: cache.addAll упал бы целиком из-за одной отсутствующей картинки.)
self.addEventListener('install', event => {
    console.log('[SW Atlas] Install — версия:', CACHE_VERSION);
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
        .then(cache => Promise.all(
            STATIC_URLS.map(url =>
                cache.add(url).catch(err => {
                    // Логируем, но не прерываем установку
                    console.warn('[SW Atlas] Не закеширован:', url, '—', err.message);
                })
            )
        ))
        .then(() => {
            console.log('[SW Atlas] Установка завершена, активируюсь сразу');
            return self.skipWaiting();
        })
        .catch(err => {
            console.error('[SW Atlas] Ошибка install:', err);
        })
    );
});

// ---------- ACTIVATE ----------
// Удаляем все кеши, кроме текущей версии.
self.addEventListener('activate', event => {
    console.log('[SW Atlas] Activate — чищу старые кеши');
    const currentCaches = [STATIC_CACHE_NAME, IMAGES_CACHE_NAME, DATA_CACHE_NAME];
    event.waitUntil(
        caches.keys()
        .then(names => Promise.all(
            names.map(name => {
                if (!currentCaches.includes(name)) {
                    console.log('[SW Atlas] Удаляю:', name);
                    return caches.delete(name);
                }
            })
        ))
        .then(() => {
            console.log('[SW Atlas] Беру контроль над клиентами');
            return self.clients.claim();
        })
    );
});

// ---------- FETCH ----------
self.addEventListener('fetch', event => {
    const request = event.request;
    
    // Игнорируем не-GET
    if (request.method !== 'GET') return;
    
    const url = new URL(request.url);
    
    // ---- Cross-origin (например, Google Fonts) ----
    // Кешируем по той же схеме, что и локальные, но через no-cors-безопасный add.
    if (url.origin !== self.location.origin) {
        // Пробуем кеш, иначе — сеть. Если и сети нет — тихо фейлим (шрифт откатится на системный).
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
                    // Кешируем только успешные opaque/basic-ответы
                    if (response && (response.ok || response.type === 'opaque')) {
                        const clone = response.clone();
                        caches.open(STATIC_CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
                    }
                    return response;
                }).catch(() => cached || Response.error());
            })
        );
        return;
    }
    
    // ---- 1) Картинки из /pictures/ — cache-first ----
    if (url.pathname.includes('/pictures/')) {
        event.respondWith(
            caches.open(IMAGES_CACHE_NAME).then(cache =>
                cache.match(request).then(cached => {
                    if (cached) return cached;
                    return fetch(request).then(response => {
                        if (response && response.ok && response.type === 'basic') {
                            cache.put(request, response.clone());
                        }
                        return response;
                    });
                })
            ).catch(() => caches.match(request))
        );
        return;
    }
    
    // ---- 2) point.json — network-first, кеш как fallback ----
    if (url.pathname.endsWith('/point.json') || url.pathname.endsWith('point.json')) {
        event.respondWith(
            fetch(request, { cache: 'no-cache' })
            .then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(DATA_CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            })
            .catch(() => {
                console.log('[SW Atlas] point.json: сеть недоступна, беру из кеша');
                return caches.match(request);
            })
        );
        return;
    }
    
    // ---- 3) nozod.json — аналогично ----
    if (url.pathname.endsWith('/nozod.json') || url.pathname.endsWith('nozod.json')) {
        event.respondWith(
            fetch(request, { cache: 'no-cache' })
            .then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(DATA_CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            })
            .catch(() => {
                console.log('[SW Atlas] nozod.json: сеть недоступна, беру из кеша');
                return caches.match(request);
            })
        );
        return;
    }
    
    // ---- 4) Навигационные запросы (HTML-страницы) ----
    // Специальная логика: сеть → кеш → fallback index.html.
    // Это спасает, если пользователь офлайн открыл /LUXE%20METALLICS.html —
    // при отсутствии в кеше он получит index.html.
    if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(request)
            .then(response => {
                if (response && response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            })
            .catch(() => {
                console.log('[SW Atlas] Навигация офлайн, ищу в кеше:', url.pathname);
                return caches.match(request).then(cached => {
                    if (cached) return cached;
                    // Пробуем декодировать пробел в имени файла
                    const decoded = decodeURIComponent(url.pathname);
                    return caches.match(new URL(decoded, self.location.origin).pathname)
                        .then(cached2 => cached2 || caches.match(FALLBACK_HTML));
                });
            })
        );
        return;
    }
    
    // ---- 5) Все остальные same-origin ресурсы — stale-while-revalidate ----
    event.respondWith(
        caches.match(request).then(cached => {
            // Фоновое обновление
            const networkPromise = fetch(request).then(response => {
                if (response && response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            }).catch(() => null);
            
            if (cached) {
                // Отдаём кеш сразу, сеть обновит его в фоне
                networkPromise.catch(() => {});
                return cached;
            }
            // Нет в кеше — ждём сеть
            return networkPromise.then(resp => resp || new Response('', {
                status: 504,
                statusText: 'Offline'
            }));
        })
    );
});

// ---------- MESSAGE ----------
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});