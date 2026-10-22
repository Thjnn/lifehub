const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const pad = (n: number) => String(n).padStart(2, '0')
const dayMonth = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
const dayDiff = (a: Date, b: Date) =>
  Math.round(
    (new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() -
      new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) /
      86_400_000,
  )

// "14:32" today, "21/10 14:32" otherwise. Date part built by hand: vi-VN output varies by browser ("21-10", "21/10").
export function formatDataTime(timestamp: number, now = new Date()) {
  const date = new Date(timestamp)
  const time = timeFormat.format(date)
  return date.toDateString() === now.toDateString() ? time : `${dayMonth(date)} ${time}`
}

// Deadline label: "Hôm nay 14:00", "Ngày mai 09:00", "Hôm qua 18:00", "25/10 14:00", "25/10/2027 14:00".
export function formatDue(iso: string, now = new Date()) {
  const date = new Date(iso)
  const time = timeFormat.format(date)
  const diff = dayDiff(date, now)
  if (diff === 0) return `Hôm nay ${time}`
  if (diff === 1) return `Ngày mai ${time}`
  if (diff === -1) return `Hôm qua ${time}`
  const year = date.getFullYear() === now.getFullYear() ? '' : `/${date.getFullYear()}`
  return `${dayMonth(date)}${year} ${time}`
}

// ISO string ⇄ <input type="datetime-local"> value ("2026-10-25T14:00", local time, no offset).
export function toDateTimeLocal(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null
}
