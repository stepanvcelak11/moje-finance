/* ---------------------------------------------------------------
   sw.js – aby aplikace fungovala i bez signálu

   POZOR: po každé úpravě souborů zvedněte VERZE o jedna,
   jinak telefon podrží starou verzi z mezipaměti.
   --------------------------------------------------------------- */

var VERZE = 'moje-finance-v2';

var SOUBORY = [
  './',
  './index.html',
  './css/styl.css',
  './js/data.js',
  './js/grafy.js',
  './js/zamek.js',
  './js/app.js',
  './manifest.webmanifest',
  './ikony/ikona-192.png',
  './ikony/ikona-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERZE)
      .then(function (c) { return c.addAll(SOUBORY); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* offline při instalaci nevadí */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (klice) {
      return Promise.all(klice.map(function (k) {
        return k === VERZE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Stránku ber nejdřív ze sítě (ať se nové verze projeví),
  // ostatní soubory z mezipaměti (ať je start okamžitý).
  var jeStranka = e.request.mode === 'navigate';

  if (jeStranka) {
    e.respondWith(
      fetch(e.request).then(function (odpoved) {
        var kopie = odpoved.clone();
        caches.open(VERZE).then(function (c) { c.put(e.request, kopie); });
        return odpoved;
      }).catch(function () {
        return caches.match(e.request).then(function (v) {
          return v || caches.match('./index.html');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (v) {
      if (v) return v;
      return fetch(e.request).then(function (odpoved) {
        if (odpoved && odpoved.status === 200 && odpoved.type === 'basic') {
          var kopie = odpoved.clone();
          caches.open(VERZE).then(function (c) { c.put(e.request, kopie); });
        }
        return odpoved;
      });
    })
  );
});
