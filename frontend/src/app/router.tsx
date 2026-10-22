import { createBrowserRouter, Navigate, redirect } from 'react-router'
import { queryClient } from '@/app/query-client'
import { ComingSoon } from '@/components/shared/ComingSoon'
import { FullPageSpinner } from '@/components/shared/FullPageSpinner'
import { NotFound } from '@/components/shared/NotFound'
import { AiCoachPage } from '@/features/ai/AiCoachPage'
import { meQuery } from '@/features/auth/api'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { AccountsPage } from '@/features/finance/AccountsPage'
import { BudgetsPage } from '@/features/finance/BudgetsPage'
import { FinanceOverviewPage } from '@/features/finance/FinanceOverviewPage'
import { ReportsPage } from '@/features/finance/ReportsPage'
import { TransactionsPage } from '@/features/finance/TransactionsPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { PreferencesPage } from '@/features/settings/PreferencesPage'
import { PrivacyPage } from '@/features/settings/PrivacyPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ApiError, tokenStore } from '@/lib/api-client'

// Routes from spec §8. Pages are placeholders until their phase; `handle.title` feeds the topbar.
const page = (path: string, title: string) => ({ path, element: <ComingSoon />, handle: { title } })

export async function requireAuth() {
  if (!tokenStore.get()) return redirect('/login')
  // Offline: the token can't be checked and a fetch would wait for the network forever.
  // Render the shell from the restored offline cache instead.
  if (!navigator.onLine) return null
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
      { path: 'dashboard', element: <DashboardPage />, handle: { title: 'Tổng quan' } },
      // FullCalendar is ~250KB: only downloaded when the calendar is opened.
      {
        path: 'calendar',
        lazy: async () => ({ Component: (await import('@/features/calendar/CalendarPage')).CalendarPage }),
        handle: { title: 'Lịch' },
      },
      { path: 'tasks', element: <TasksPage />, handle: { title: 'Công việc' } },
      {
        path: 'finance',
        children: [
          { index: true, element: <FinanceOverviewPage />, handle: { title: 'Tài chính' } },
          { path: 'transactions', element: <TransactionsPage />, handle: { title: 'Giao dịch' } },
          { path: 'accounts', element: <AccountsPage />, handle: { title: 'Tài khoản' } },
          { path: 'budgets', element: <BudgetsPage />, handle: { title: 'Ngân sách' } },
          { path: 'reports', element: <ReportsPage />, handle: { title: 'Báo cáo' } },
        ],
      },
      { path: 'ai-coach', element: <AiCoachPage />, handle: { title: 'AI Coach' } },
      {
        path: 'settings',
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          page('profile', 'Hồ sơ'),
          { path: 'preferences', element: <PreferencesPage />, handle: { title: 'Tùy chọn' } },
          { path: 'privacy', element: <PrivacyPage />, handle: { title: 'Quyền riêng tư' } },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])
