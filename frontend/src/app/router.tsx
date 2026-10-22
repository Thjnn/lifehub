import { createBrowserRouter, Navigate, redirect } from 'react-router'
import { queryClient } from '@/app/query-client'
import { ComingSoon } from '@/components/shared/ComingSoon'
import { FullPageSpinner } from '@/components/shared/FullPageSpinner'
import { NotFound } from '@/components/shared/NotFound'
import { meQuery } from '@/features/auth/api'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ApiError, tokenStore } from '@/lib/api-client'

// Routes from spec §8. Pages are placeholders until their phase; `handle.title` feeds the topbar.
const page = (path: string, title: string) => ({ path, element: <ComingSoon />, handle: { title } })

async function requireAuth() {
  if (!tokenStore.get()) return redirect('/login')
  try {
    await queryClient.ensureQueryData(meQuery)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return redirect('/login')
    // Network/5xx: still render the shell; the topbar query shows the error and retries.
  }
  return null
}

const redirectIfAuthenticated = () => (tokenStore.get() ? redirect('/app/dashboard') : null)

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <AuthLayout />,
    loader: redirectIfAuthenticated,
    children: [
      { path: 'login', element: <LoginPage />, handle: { title: 'Đăng nhập' } },
      { path: 'register', element: <RegisterPage />, handle: { title: 'Đăng ký' } },
      { path: 'forgot-password', element: <ForgotPasswordPage />, handle: { title: 'Quên mật khẩu' } },
      { path: 'reset-password', element: <ResetPasswordPage />, handle: { title: 'Đặt lại mật khẩu' } },
    ],
  },
  {
    path: '/app',
    element: <AppLayout />,
    loader: requireAuth,
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      page('dashboard', 'Tổng quan'),
      page('calendar', 'Lịch'),
      page('tasks', 'Công việc'),
      {
        path: 'finance',
        children: [
          { index: true, element: <ComingSoon />, handle: { title: 'Tài chính' } },
          page('transactions', 'Giao dịch'),
          page('accounts', 'Tài khoản'),
          page('budgets', 'Ngân sách'),
          page('reports', 'Báo cáo'),
        ],
      },
      page('ai-coach', 'AI Coach'),
      {
        path: 'settings',
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          page('profile', 'Hồ sơ'),
          page('preferences', 'Tùy chọn'),
          page('privacy', 'Quyền riêng tư'),
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])
