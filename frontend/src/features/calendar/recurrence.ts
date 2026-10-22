// The "recurring cơ bản" subset the form offers (spec §9.2). Weekly/monthly repeat on the weekday/day of the first event.
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'

export const repeatOptions: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Không lặp lại' },
  { value: 'daily', label: 'Hằng ngày' },
  { value: 'weekly', label: 'Hằng tuần' },
  { value: 'monthly', label: 'Hằng tháng' },
]

const freqOf: Record<Exclude<Repeat, 'none'>, string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' }
const pad = (n: number) => String(n).padStart(2, '0')

// until = "YYYY-MM-DD" (local, inclusive) or "" for no end.
export function buildRule(repeat: Repeat, until: string): string | null {
  if (repeat === 'none') return null
  let rule = `FREQ=${freqOf[repeat]}`
  if (until) {
    // End of that local day, in UTC basic format: 20261231T165959Z
    rule += `;UNTIL=${new Date(`${until}T23:59:59`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
  }
  return rule
}

export function parseRule(rule: string | null): { repeat: Repeat; until: string } {
  if (!rule) return { repeat: 'none', until: '' }
  const parts = Object.fromEntries(rule.split(';').map((part) => part.split('=')))
  const repeat = (Object.entries(freqOf).find(([, freq]) => freq === parts.FREQ)?.[0] ?? 'none') as Repeat
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(parts.UNTIL ?? '')
  if (!match) return { repeat, until: '' }
  const [, y, mo, d, h, mi, s] = match.map(Number)
  const local = new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  return { repeat, until: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}` }
}
