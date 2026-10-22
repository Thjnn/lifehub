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

// IndexedDB read takes a few ms; doing it first lets the app open offline with the last data.
await restoreOfflineCache()

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
