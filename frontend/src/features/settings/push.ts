import { api } from '@/lib/api-client'

// Deadline reminders by Web Push (spec §15.2). Each device/browser subscribes on its own.

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// iPhone/iPad only get Web Push from a PWA added to the home screen (iOS 16.4+).
export const needsHomeScreenInstall = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  !(window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

async function registration() {
  // No service worker in `npm run dev` (vite-plugin-pwa is off in dev): push needs a build.
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('Thông báo cần bản đã build (npm run build + preview, hoặc bản deploy) — chế độ dev không có service worker.')
  return reg
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

// VAPID public key (base64url) → the bytes pushManager.subscribe expects.
const keyBytes = (base64url: string) => Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

export async function enablePush() {
  const { data } = await api<{ data: { public_key: string | null } }>('/push/key')
  if (!data.public_key) throw new Error('Máy chủ chưa bật nhắc hạn chót (thiếu khoá VAPID).')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Thông báo đang bị chặn. Cho phép thông báo cho LIFEHUB trong cài đặt trình duyệt rồi thử lại.')

  const reg = await registration()
  const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.public_key) }))
  await api('/push/subscriptions', { method: 'POST', body: subscription.toJSON() as Record<string, unknown> })
}

// Switched off, or signing out: forget this device on the server, then in the browser.
export async function disablePush() {
  const subscription = await currentSubscription()
  if (!subscription) return
  try {
    await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } })
  } finally {
    await subscription.unsubscribe()
  }
}
