import type { DayCellContentArg, DayHeaderContentArg } from '@fullcalendar/core'
import { formatLunar, lunarHoliday, toLunar } from '@/lib/lunar'
import { cn } from '@/lib/utils'

// Usual Vietnamese calendar style: just the day ("12"), month added on mùng 1 ("1/9", "1/6N" for a leap month).
function lunarDayLabel(date: Date) {
  const lunar = toLunar(date)
  return { text: lunar.day === 1 ? formatLunar(lunar) : String(lunar.day), highlight: lunar.day === 1 || lunar.day === 15 }
}

// Month view cell: solar day, lunar day, and a lunar holiday name if any.
export function LunarDayCell({ arg, showLunar }: { arg: DayCellContentArg; showLunar: boolean }) {
  if (!showLunar) return <>{arg.dayNumberText}</>
  const { text, highlight } = lunarDayLabel(arg.date)
  const holiday = lunarHoliday(arg.date)

  return (
    <span className="flex flex-col items-end leading-tight">
      <span>
        <span className={cn('lh-lunar mr-1.5', highlight && 'lh-lunar-highlight')}>{text}</span>
        {arg.dayNumberText}
      </span>
      {holiday && <span className="lh-holiday">{holiday}</span>}
    </span>
  )
}

// Day/week column headers and list-view day headers: "T2 02/11 · 12/9 ÂL"; holiday shown as a tooltip.
export function LunarDayHeader({ arg, showLunar }: { arg: DayHeaderContentArg; showLunar: boolean }) {
  if (!showLunar || arg.view.type === 'dayGridMonth') return <>{arg.text}</>
  const holiday = lunarHoliday(arg.date)

  return (
    <span title={holiday}>
      {arg.text}
      <span className={cn('lh-lunar ml-1', holiday && 'lh-lunar-highlight')}>· {formatLunar(toLunar(arg.date))} ÂL</span>
    </span>
  )
}
