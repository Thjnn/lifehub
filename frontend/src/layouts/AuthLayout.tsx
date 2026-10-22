import { Outlet } from 'react-router'
import { Brand } from '@/components/shared/Brand'

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Brand className="text-lg" />
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
