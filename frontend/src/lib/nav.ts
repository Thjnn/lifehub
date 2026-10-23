import { CalendarDays, LayoutDashboard, ListTodo, NotebookPen, Salad, Settings, Sparkles, Wallet, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  children?: { to: string; label: string; end?: boolean }[]
}

// Single source for sidebar, bottom nav and section tabs.
export const navItems: NavItem[] = [
  { to: '/app/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/app/tasks', label: 'Công việc', icon: ListTodo },
  { to: '/app/calendar', label: 'Lịch', icon: CalendarDays },
  {
    to: '/app/finance',
    label: 'Tài chính',
    icon: Wallet,
    children: [
      { to: '/app/finance', label: 'Tổng quan', end: true },
      { to: '/app/finance/transactions', label: 'Giao dịch' },
      { to: '/app/finance/accounts', label: 'Tài khoản' },
      { to: '/app/finance/budgets', label: 'Ngân sách' },
      { to: '/app/finance/reports', label: 'Báo cáo' },
    ],
  },
  {
    to: '/app/nutrition',
    label: 'Dinh dưỡng',
    icon: Salad,
    children: [
      { to: '/app/nutrition', label: 'Nhật ký', end: true },
      { to: '/app/nutrition/plan', label: 'Thực đơn tuần' },
    ],
  },
  { to: '/app/notes', label: 'Ghi chú', icon: NotebookPen },
  { to: '/app/ai-coach', label: 'AI Coach', icon: Sparkles },
  {
    to: '/app/settings',
    label: 'Cài đặt',
    icon: Settings,
    children: [
      { to: '/app/settings/profile', label: 'Hồ sơ' },
      { to: '/app/settings/preferences', label: 'Tùy chọn' },
      { to: '/app/settings/privacy', label: 'Quyền riêng tư' },
    ],
  },
]

// The first 4 items sit in the mobile bottom nav; the rest go under "Thêm".
export const bottomNavItems = navItems.slice(0, 4)
export const moreNavItems = navItems.slice(4)
