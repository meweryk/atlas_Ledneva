// =============================================================
//  Service Worker для Атласа Леднёва
//  Версия: v5.01
//  - Относительные пути (GitHub Pages, любая подпапка)
//  - Локальный vendor (Bootstrap, Icons, Tailwind)
//  - Предзагрузка всех фото из pictures/ через point.json
// =============================================================

const CACHE_VERSION = 'v5.09';
const STATIC_CACHE_NAME = `atlas-static-${CACHE_VERSION}`;
const IMAGES_CACHE_NAME = `atlas-images-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `atlas-data-${CACHE_VERSION}`;

// Базовый URL = папка, где лежит service-worker.js.
const BASE_URL = new URL('./', self.location);
const FALLBACK_HTML = new URL('./index.html', BASE_URL).pathname;

// ---------- Статические ресурсы ----------
const STATIC_URLS = [
    './',
    './index.html',
    './LUXE METALLICS.html',
    './manifest.json',
    './point.json',
    './nozod.json',
    
    // JS / CSS приложения
    './css/style.css',
    './js/atlas-ui.js', 
    './js/app.js',
    './js/star.js',
    './js/nozod.js',
    
    // Локальный Bootstrap
    './vendor/bootstrap.min.css',
    './vendor/bootstrap.bundle.min.js',
    './vendor/bootstrap-icons.min.css',
    './vendor/fonts/bootstrap-icons.woff',
    './vendor/fonts/bootstrap-icons.woff2',
    
    // Локальный Tailwind
    './vendor/tailwind.css',
    
    // Иконки PWA (если чего-то нет — per-file catch в install это переживёт)
    './pictures/icon-192.png',
    './pictures/icon-512.png'
];

// ---------- Предзагрузка всех фото из point.json ----------
// SW не может «прочитать содержимое папки», поэтому берём список
// изображений из point.json (поля images у точек и links у патологий)
// и кешируем их в IMAGES_CACHE_NAME.
async function precachePointImages() {
    try {
        const resp = await fetch('./point.json', { cache: 'no-cache' });
        if (!resp.ok) {
            console.warn('[SW Atlas] point.json недоступен, пропускаю предзагрузку фото');
            return;
        }
        const data = await resp.json();
        if (!Array.isArray(data)) return;
        
        const urls = new Set();
        
        const collect = (obj) => {
            if (!obj) return;
            // у точек: images (массив строк)
            if (Array.isArray(obj.images)) {
                obj.images.forEach(u => {
                    if (typeof u === 'string' && u.trim()) urls.add(u.trim());
                });
            }
            // у патологий: links (массив строк)
            if (Array.isArray(obj.links)) {
                obj.links.forEach(u => {
                    if (typeof u === 'string' && u.trim()) urls.add(u.trim());
                });
            }
            // иногда images может быть строкой с запятыми
            if (typeof obj.images === 'string' && obj.images.trim()) {
                obj.images.split(',').forEach(u => {
                    if (u.trim()) urls.add(u.trim());
                });
            }
        };
        
        data.forEach(pathology => {
            collect(pathology);
            (pathology.point || []).forEach(collect);
        });
        
        // Оставляем только same-origin (внешние http(s) — не наш случай,
        // они и так лениво закешируются при первом открытии)
        const localUrls = Array.from(urls).filter(u => {
            if (/^https?:\/\//i.test(u)) return false;
            if (u.startsWith('data:')) return false;
            return true;
        });
        
        console.log('[SW Atlas] Найдено изображений в point.json:', localUrls.length);
        
        const cache = await caches.open(IMAGES_CACHE_NAME);
        await Promise.all(localUrls.map(u =>
            cache.add(u).catch(err => {
                console.warn('[SW Atlas] Не закешировано фото:', u, '—', err.message);
            })
        ));
        
        console.log('[SW Atlas] Предзагрузка фото завершена');
    } catch (e) {
        console.warn('[SW Atlas] Ошибка предзагрузки фото:', e);
    }
}

// ---------- INSTALL ----------
self.addEventListener('install', event => {
    console.log('[SW Atlas] Install — версия:', CACHE_VERSION);
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
        .then(cache => Promise.all(
            STATIC_URLS.map(url =>
                cache.add(url).catch(err => {
                    console.warn('[SW Atlas] Не закеширован:', url, '—', err.message);
                })
            )
        ))
        .then(() => {
            // После статики — тянем фотографии из point.json
            return precachePointImages();
        })
        .then(() => {
            console.log('[SW Atlas] Установка завершена, активируюсь сразу');
        })
        .catch(err => {
            console.error('[SW Atlas] Ошибка install:', err);
        })
    );
});

// ---------- ACTIVATE ----------
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
    if (request.method !== 'GET') return;
    
    const url = new URL(request.url);
    
    // ---- Cross-origin (Google Fonts и т. п.) ----
    if (url.origin !== self.location.origin) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
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
    
    // ---- 2) point.json — network-first ----
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
    
    // ---- 3) nozod.json — network-first ----
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
    
    // ---- 4) Навигационные запросы (HTML) ----
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
                    // Пробуем декодировать %20 в имени файла
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
            const networkPromise = fetch(request).then(response => {
                if (response && response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE_NAME).then(c => c.put(request, clone));
                }
                return response;
            }).catch(() => null);
            
            if (cached) {
                networkPromise.catch(() => {});
                return cached;
            }
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