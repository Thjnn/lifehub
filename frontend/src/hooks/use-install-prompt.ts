import { useSyncExternalStore } from 'react'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

// Chrome/Edge/Android fire beforeinstallprompt once, possibly before React mounts — so listen at import time.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault() // keep the browser's mini-infobar away; we show our own button
  deferredPrompt = event as BeforeInstallPromptEvent
  emit()
})
window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  emit()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

// iPadOS reports itself as a Mac; touch support gives it away.
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

export function useInstallPrompt() {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt)

  return {
    // Android / desktop Chrome: native install dialog.
    canPrompt: prompt !== null,
    // iOS has no install API: show "Share → Add to Home Screen" instructions instead (spec §6.1).
    needsIosInstructions: prompt === null && isIos() && !isStandalone(),
    async install() {
      if (!deferredPrompt) return
      await deferredPrompt.prompt()
      deferredPrompt = null // a prompt can only be used once
      emit()
    },
  }
}
