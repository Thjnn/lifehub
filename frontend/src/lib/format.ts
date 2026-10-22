const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const pad = (n: number) => String(n).padStart(2, '0')

// "14:32" today, "21/10 14:32" otherwise. Date part built by hand: vi-VN output varies by browser ("21-10", "21/10").
export function formatDataTime(timestamp: number, now = new Date()) {
  const date = new Date(timestamp)
  const time = timeFormat.format(date)
  return date.toDateString() === now.toDateString() ? time : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${time}`
}
