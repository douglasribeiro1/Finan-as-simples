const CACHE_NAME = 'financas-pwa-v1';

// Arquivos para fazer cache inicial
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  // Fazendo cache dos CDNs base para garantir funcionamento sem rede
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aberto com sucesso');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptação de Requisições (Estratégia: Stale-While-Revalidate / Network First)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições do Firebase (o SDK lida com offline sozinho via IndexedDB)
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('securetoken.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Atualiza o cache de forma silenciosa se a requisição for bem sucedida
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Trata erro de rede (offline) silenciosamente para arquivos estáticos
      });

      // Retorna o cache IMEDIATAMENTE se existir, enquanto a rede busca a atualização por baixo dos panos
      return cachedResponse || fetchPromise;
    })
  );
});
