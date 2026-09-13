const CACHE='color-clash-v3';
const CACHE_PREFIX='color-clash-';
const FILES=['./','./index.html','./manifest.json','./assets/css/style.css','./assets/js/main.js','./favicon.ico','./assets/icons/favicon.svg','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/audio/start.mp3','./assets/audio/correct.mp3','./assets/audio/wrong.mp3','./assets/audio/tick.mp3','./assets/audio/timeout.mp3','./assets/audio/record.mp3'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request))));
