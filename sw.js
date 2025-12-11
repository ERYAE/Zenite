/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ZENITE OS - Service Worker (PWA)
// ═══════════════════════════════════════════════════════════════════════════════
// Estratégia: Network-first com fallback para cache offline

const CACHE_NAME = 'zenite-v2.3.0-all-fixes';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/css/output.css',
  '/js/app.js',
  '/images/zenite_logo.svg',
  '/images/favicon-black.svg',
  '/images/favicon-white.svg'
];

// Instalação: Cacheia assets críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_ASSETS).catch((err) => {
        console.warn('[SW] Falha ao cachear alguns assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

// Fetch: Network-first, fallback para cache
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Ignora requests não-GET, Supabase, e schemes não-HTTP (chrome-extension, etc.)
  if (
    event.request.method !== 'GET' || 
    url.includes('supabase.co') ||
    !url.startsWith('http')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona a resposta para cachear (apenas HTTP/HTTPS)
        if (response.status === 200 && url.startsWith('http')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback para cache se offline
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline - recurso não disponível', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});
