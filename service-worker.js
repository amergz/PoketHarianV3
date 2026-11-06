// categories-pwa-1
// Render private access: never serve cached pages, login, session or API responses.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('poket-harian-cache-'))await caches.delete(key);await self.clients.claim();})()));
// No fetch interception: the backend checks every network request.
