// Pages with the floating AI assistant. `page` must match `Coach::PAGES` on the backend, which fetches the page's
// data itself: the client only says where the user is and which month/day the page shows.

export type PageContext = { page: string; label: string; month?: string; date?: string; suggestions: string[] }

const pages: Record<string, Omit<PageContext, 'month' | 'date'>> = {
  '/app/dashboard': { page: 'dashboard', label: 'Tổng quan', suggestions: ['Hôm nay tôi nên làm gì trước?', 'Tóm tắt tình hình tháng này giúp tôi'] },
  '/app/tasks': { page: 'tasks', label: 'Công việc', suggestions: ['Việc nào nên làm trước hôm nay?', 'Có việc nào sắp trễ hạn không?'] },
  '/app/calendar': { page: 'calendar', label: 'Lịch', suggestions: ['Tuần này lịch có dày quá không?', 'Hôm nay tôi rảnh lúc nào?'] },
  '/app/finance': { page: 'finance', label: 'Tài chính', suggestions: ['Tháng này tôi chi tiêu có ổn không?', 'Mục nào tốn nhiều tiền nhất?'] },
  '/app/finance/transactions': {
    page: 'finance.transactions',
    label: 'Giao dịch',
    suggestions: ['Tháng này tôi tiêu nhiều nhất vào đâu?', 'Có khoản chi nào nên cắt bớt không?'],
  },
  '/app/finance/accounts': { page: 'finance.accounts', label: 'Tài khoản', suggestions: ['Sắp tới tôi phải trả khoản nợ nào?'] },
  '/app/finance/budgets': { page: 'finance.budgets', label: 'Ngân sách', suggestions: ['Có mục nào sắp vượt ngân sách không?', 'Tôi nên cắt giảm mục nào?'] },
  '/app/finance/reports': { page: 'finance.reports', label: 'Báo cáo', suggestions: ['Nhận xét chi tiêu tháng này giúp tôi', 'So với ngân sách thì sao?'] },
  '/app/nutrition': { page: 'nutrition', label: 'Nhật ký ăn uống', suggestions: ['Hôm nay tôi ăn đủ chưa?', 'Bữa tối nên ăn gì cho đủ đạm?'] },
  '/app/nutrition/plan': {
    page: 'nutrition.plan',
    label: 'Thực đơn tuần',
    suggestions: ['Thực đơn tuần này có cân bằng không?', 'Tuần này tôi theo thực đơn được bao nhiêu?'],
  },
  '/app/nutrition/workouts': { page: 'nutrition.workouts', label: 'Tập luyện', suggestions: ['Tuần này tôi tập đủ chưa?', 'Buổi tới nên tập gì?'] },
  '/app/nutrition/body': { page: 'nutrition.body', label: 'Cân nặng', suggestions: ['Cân nặng của tôi đang thay đổi thế nào?'] },
}

/** The assistant's context for a URL, or null where there is none (AI Coach itself, notes, settings). */
export function pageContextFor(pathname: string, search: string): PageContext | null {
  const base = pages[pathname.replace(/\/+$/, '')]
  if (!base) return null

  const params = new URLSearchParams(search)
  const month = params.get('month') ?? ''
  // Nutrition log = ?date=, meal plan = ?week= (its Monday): both are "the day the page shows" for the server.
  const date = params.get('date') ?? params.get('week') ?? ''

  return {
    ...base,
    ...(/^\d{4}-\d{2}$/.test(month) && { month }),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) && { date }),
  }
}
