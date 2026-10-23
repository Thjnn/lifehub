/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// Our own service worker (vite-plugin-pwa `injectManifest`), needed for Web Push (spec §15.2).
// The first part does what the generated one did: precache the app shell only (offline level 1) —
// API GETs are never cached here; TanStack Query persists them (spec §6.4).

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0] }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// SPA: deep links open the cached index.html — but never for the API.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))

// registerType 'prompt': the new version waits until the user taps "Cập nhật" (PwaUpdatePrompt).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

type Reminder = { title: string; body: string; url: string; tag: string }

// Deadline reminder sent by the backend: one combined notification.
self.addEventListener('push', (event) => {
  let data: Reminder
  try {
    data = event.data!.json() as Reminder
  } catch {
    return
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag, // a newer reminder replaces the previous one instead of stacking
      icon: '/icons/pwa-192x192.png',
      badge: '/icons/pwa-64x64.png',
      lang: 'vi',
      data: { url: data.url },
    }),
  )
})

// Tap → focus an open LIFEHUB window on the tasks page, or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string } | null)?.url ?? '/app/tasks', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        return open.navigate(url)
      }
      return self.clients.openWindow(url)
    })(),
  )
})
