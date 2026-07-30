const CACHE_NAME = 'open-transit-shell-v1'
const INSTALL_FILES = [
  '/',
  '/privacy.html',
  '/manifest.webmanifest',
  '/icons/app-icon-192.png',
  '/icons/app-icon-512.png',
  '/icons/app-icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(INSTALL_FILES)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never intercept API responses, coordinates, CTA data, or third-party map tiles.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          return response
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/'))),
    )
    return
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        return response
      })),
    )
  }
})
