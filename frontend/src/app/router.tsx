import { createBrowserRouter, Navigate } from 'react-router'
import { ComingSoon } from '@/components/shared/ComingSoon'
import { NotFound } from '@/components/shared/NotFound'
import { LandingPage } from '@/features/landing/LandingPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'

// Routes from spec §8. Pages are placeholders until their phase; `handle.title` feeds the topbar.
const page = (path: string, title: string) => ({ path, element: <ComingSoon />, handle: { title } })

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <AuthLayout />,
    children: [
      page('login', 'Đăng nhập'),
      page('register', 'Đăng ký'),
      page('forgot-password', 'Quên mật khẩu'),
      page('reset-password', 'Đặt lại mật khẩu'),
    ],
  },
  {
    path: '/app',
    element: <AppLayout />,
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
