import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CalendarPlus, ListTodo, MapPin, RotateCw, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BriefingCard } from '@/features/ai/BriefingCard'
import { meQuery } from '@/features/auth/api'
import { dashboardQuery, weatherQuery, type Dashboard, type Weather } from '@/features/dashboard/api'
import { weatherLabel } from '@/features/dashboard/weather'
import { WeatherIcon } from '@/features/dashboard/WeatherIcon'
import { dueItemTitle } from '@/features/finance/debts'
import { StatTile } from '@/features/finance/StatTile'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatDayHeader, formatDue, fromDateKey } from '@/lib/format'
import { formatLunar, lunarYearName, toLunar } from '@/lib/lunar'
import { mapsUrl } from '@/lib/maps'
import { formatVnd } from '@/lib/money'
import { cn } from '@/lib/utils'

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const longDate = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })

function greeting(hour: number) {
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

function headerText() {
  const now = new Date()
  const lunar = toLunar(now)
  const date = longDate.format(now)
  return {
    hello: greeting(now.getHours()),
    date: `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${formatLunar(lunar)} âm lịch, năm ${lunarYearName(lunar.year)}`,
  }
}

// /app/dashboard (spec §9.1): real data only, each figure with its period; AI briefing on top when online.
export function DashboardPage() {
  const online = useOnlineStatus()
  const me = useQuery(meQuery)
  const dashboard = useQuery(dashboardQuery)
  const weather = useQuery(weatherQuery)
  const [header] = useState(headerText)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-4">
          <div>
            <h2 className="text-xl font-semibold">
              {header.hello}
              {me.data ? `, ${me.data.name.trim().split(/\s+/).at(-1)}` : ''}
            </h2>
            <p className="text-sm text-muted-foreground">{header.date}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickAction to="/app/tasks?new=1" icon={ListTodo} label="Công việc" />
            <QuickAction to="/app/calendar?new=1" icon={CalendarPlus} label="Sự kiện" />
            <QuickAction to="/app/finance/transactions?new=1" icon={Wallet} label="Giao dịch" />
          </div>
        </section>
        <WeatherCard weather={weather.data} pending={weather.isPending} error={weather.error?.message} onRetry={() => weather.refetch()} />
      </div>

      {online && <BriefingCard />}

      {dashboard.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : dashboard.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {online ? dashboard.error.message : 'Bạn đang offline và chưa có dữ liệu lưu sẵn.'}
          {online && (
            <Button variant="outline" onClick={() => dashboard.refetch()}>
              <RotateCw />
              Thử lại
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TodayCard data={dashboard.data} />
          <FinanceCard data={dashboard.data} />
        </div>
      )}
    </div>
  )
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof ListTodo; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to={to}>
        <Icon />
        {label}
      </Link>
    </Button>
  )
}

function WeatherCard({
  weather,
  pending,
  error,
  onRetry,
}: {
  weather: Weather | null | undefined
  pending: boolean
  error?: string
  onRetry: () => void
}) {
  if (pending) return <Skeleton className="h-40" />
  // City chosen but the forecast failed: show why, don't pretend no city is set.
  if (error) {
    return (
      <section className="flex flex-col items-start justify-center gap-2 rounded-xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground">
        {error}
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw />
          Thử lại
        </Button>
      </section>
    )
  }
  if (!weather) {
    return (
      <section className="flex flex-col items-start justify-center gap-2 rounded-xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground">
        Chọn thành phố để xem thời tiết và để AI Coach nhắc khi trời mưa.
        <Button size="sm" variant="outline" asChild>
          <Link to="/app/settings/preferences">Chọn thành phố</Link>
        </Button>
      </section>
    )
  }

  // Rain within the next hours is the actionable bit: surface the first likely hour.
  const rain = weather.hourly.find((h) => h.precipitation_probability >= 60)

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <WeatherIcon code={weather.current.weather_code} className="size-10 text-primary" />
        <div className="flex-1">
          <p className="text-2xl font-semibold tabular-nums">{Math.round(weather.current.temperature)}°C</p>
          <p className="text-xs text-muted-foreground">
            {weatherLabel(weather.current.weather_code)} · cảm giác {Math.round(weather.current.feels_like)}° · {weather.city}
          </p>
        </div>
      </div>
      {rain && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="size-3.5" aria-hidden />
          Có thể mưa lúc {rain.time.slice(11, 16)} ({rain.precipitation_probability}%)
        </p>
      )}
      <ul className="grid grid-cols-3 gap-2 text-center text-xs">
        {weather.daily.map((d, i) => (
          <li key={d.date} className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
            <span className="text-muted-foreground">{i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : formatDayHeader(fromDateKey(d.date)).split(',')[0]}</span>
            <WeatherIcon code={d.weather_code} className="size-5" />
            <span className="tabular-nums">
              {Math.round(d.min)}–{Math.round(d.max)}°
            </span>
            <span className="text-muted-foreground tabular-nums">💧{d.precipitation_probability}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TodayCard({ data }: { data: Dashboard }) {
  const { tasks, events_today: events, debts_due: debts } = data
  const percent = tasks.due_today_total ? Math.round((tasks.due_today_done / tasks.due_today_total) * 100) : 0

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Hôm nay</h2>
        <Link to="/app/tasks?view=today" className="text-xs text-primary hover:underline">
          Xem công việc
        </Link>
      </div>

      {tasks.due_today_total > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">
            Xong <b className="tabular-nums">{tasks.due_today_done}</b>/{tasks.due_today_total} việc đến hạn hôm nay
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Việc hôm nay đã xong" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Không có việc nào đến hạn hôm nay.</p>
      )}

      {tasks.overdue_count > 0 && (
        <TaskList title={`Quá hạn (${tasks.overdue_count})`} tone="danger" items={tasks.overdue.map((t) => ({ id: t.id, title: t.title, when: formatDue(t.due_at!) }))} />
      )}
      {tasks.upcoming.length > 0 && (
        <TaskList title="Sắp đến hạn (3 ngày)" items={tasks.upcoming.map((t) => ({ id: t.id, title: t.title, when: formatDue(t.due_at!) }))} />
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Lịch hôm nay</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có sự kiện.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.key} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
                  {timeFormat.format(new Date(e.start_at))}–{timeFormat.format(new Date(e.end_at))}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{e.title}</span>
                  {e.location && (
                    <a href={mapsUrl(e.location)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <MapPin className="size-3" aria-hidden />
                      {e.location}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {debts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Khoản nợ đến hạn</h3>
          <ul className="flex flex-col gap-1.5">
            {debts.map((d) => (
              <li key={`${d.account_id}-${d.due_date}`} className="flex items-center justify-between gap-2 text-sm">
                <span className={cn('truncate', d.overdue && 'text-destructive')}>
                  {dueItemTitle({ account_type: d.account_type as 'liability' | 'receivable', account_name: d.account_name })} ·{' '}
                  {d.overdue ? 'quá hạn' : formatDayHeader(fromDateKey(d.due_date)).toLowerCase()}
                </span>
                <span className="font-medium tabular-nums">{formatVnd(d.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function TaskList({ title, items, tone }: { title: string; items: { id: string; title: string; when: string }[]; tone?: 'danger' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={cn('flex items-center gap-1 text-xs font-medium', tone === 'danger' ? 'text-destructive' : 'text-muted-foreground')}>
        {tone === 'danger' ? <AlertTriangle className="size-3.5" aria-hidden /> : <CalendarClock className="size-3.5" aria-hidden />}
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        {items.map((t) => (
          <li key={t.id} className="flex justify-between gap-2 text-sm">
            <span className="truncate">{t.title}</span>
            <span className={cn('shrink-0 text-xs', tone === 'danger' ? 'text-destructive' : 'text-muted-foreground')}>{t.when}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FinanceCard({ data }: { data: Dashboard }) {
  const { finance } = data
  const used = finance.budget ? Math.round((Number(finance.expense) / Number(finance.budget.amount)) * 100) : null

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Tài chính tháng {Number(finance.month.slice(5))}</h2>
        <Link to="/app/finance" className="text-xs text-primary hover:underline">
          Xem chi tiết
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Đã chi tháng này" value={finance.expense} className="p-3" />
        <StatTile label="Đã thu tháng này" value={finance.income} className="p-3" />
      </div>
      {finance.budget && used !== null ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>Ngân sách tháng</span>
            <span className="tabular-nums text-muted-foreground">
              {used}% · còn {formatVnd(finance.budget.remaining)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Đã dùng ngân sách tháng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(used, 100)}>
            <div
              className={cn('h-full rounded-full', used > 100 ? 'bg-destructive' : used >= 80 ? 'bg-warning' : 'bg-primary')}
              style={{ width: `${Math.min(used, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chưa đặt ngân sách tổng cho tháng này.{' '}
          <Link to="/app/finance/budgets" className="text-primary hover:underline">
            Đặt ngân sách
          </Link>
        </p>
      )}
    </section>
  )
}
