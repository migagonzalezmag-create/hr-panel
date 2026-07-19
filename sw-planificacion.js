// Service Worker mínimo para Planificación Horaria - habilita instalación como app (PWA)
const CACHE_NAME = 'planificacion-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Estrategia: red primero, sin cachear datos (siempre traer info fresca del Sheets)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Sin conexión. Intentá de nuevo cuando tengas internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })
  );
});
