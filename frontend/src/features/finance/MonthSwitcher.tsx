import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMonth, shiftMonth } from '@/lib/format'

// ‹ Tháng 10/2026 ›  — can't go past the current month.
export function MonthSwitcher({ month, max, onChange }: { month: string; max: string; onChange: (month: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" aria-label="Tháng trước" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft />
      </Button>
      <span className="font-semibold">{formatMonth(month)}</span>
      <Button variant="ghost" size="icon" aria-label="Tháng sau" disabled={month >= max} onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight />
      </Button>
    </div>
  )
}
