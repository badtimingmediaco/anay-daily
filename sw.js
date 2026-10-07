/* Anay Daily — service worker: makes the app installable and work offline. */
var CACHE = 'anay-daily-v1';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch(_) { return; }

  // Never cache the sync backend — always go to network.
  if(url.hostname.indexOf('supabase.co') >= 0) return;

  // App pages: serve the cached shell first (instant, offline-safe).
  if(req.mode === 'navigate'){
    e.respondWith(caches.match('./index.html').then(function(r){ return r || fetch(req); }));
    return;
  }

  // Everything else (icons, fonts): cache-first, then fill the cache from the network.
  e.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(resp){
        try{
          var sameOrigin = url.origin === self.location.origin;
          var isFont = url.hostname.indexOf('gstatic') >= 0 || url.hostname.indexOf('googleapis') >= 0;
          var isCdn = url.hostname.indexOf('jsdelivr.net') >= 0;
          if(resp && (sameOrigin || isFont || isCdn)){
            var clone = resp.clone();
            caches.open(CACHE).then(function(c){ c.put(req, clone); });
          }
        }catch(_){}
        return resp;
      }).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
