import '@fontsource-variable/inter'
import './index.css'
import { StrictMode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { queryClient, restoreOfflineCache } from '@/app/query-client'
import { router } from '@/app/router'
import { PwaUpdatePrompt } from '@/components/shared/PwaUpdatePrompt'
import { ServerWakingBanner } from '@/components/shared/ServerWakingBanner'
import { Toaster } from '@/components/ui/sonner'
import { startOutboxSync } from '@/offline/outbox'

// A tab still running an old build can ask for a lazy chunk (e.g. the calendar) that a newer deploy deleted.
// Reload once to get the current build; the flag stops a reload loop if the file is really gone.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('lifehub.reloaded-for-update')) return
    sessionStorage.setItem('lifehub.reloaded-for-update', '1')
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

// IndexedDB read takes a few ms; doing it first lets the app open offline with the last data.
await restoreOfflineCache()
// Replay offline writes (spec §6.3): now, on reconnect, when the app returns to the foreground, every minute.
startOutboxSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
    <ServerWakingBanner />
    <Toaster position="top-center" />
    <PwaUpdatePrompt />
  </StrictMode>,
)
