// Vietnamese lunar calendar (âm lịch), after Hồ Ngọc Đức's algorithm (https://www.informatik.uni-leipzig.de/~duc/amlich/).
// Uses UTC+7: Chinese libraries use UTC+8 and occasionally land New Year on a different day (e.g. Tết 1985, 2007).

const TZ = 7
const PI = Math.PI
const dr = PI / 180

function jdFromDate(dd: number, mm: number, yy: number) {
  const a = Math.floor((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083
  return jd
}

// Julian day of the k-th new moon after 1900-01-01 (Meeus, Astronomical Algorithms).
function newMoon(k: number) {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  const deltaT =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2
  return jd1 + C1 - deltaT
}

const newMoonDay = (k: number) => Math.floor(newMoon(k) + 0.5 + TZ / 24)

// Sun's longitude as one of 12 sectors (0 = vernal equinox) at local midnight.
function sunLongitudeSector(dayNumber: number) {
  const T = (dayNumber - 0.5 - TZ / 24 - 2451545.0) / 36525
  const T2 = T * T
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = (L0 + DL) * dr
  L -= PI * 2 * Math.floor(L / (PI * 2))
  return Math.floor((L / PI) * 6)
}

// Start of lunar month 11 (the one containing the winter solstice) of a solar year.
function lunarMonth11(yy: number) {
  const k = Math.floor((jdFromDate(31, 12, yy) - 2415021) / 29.530588853)
  const nm = newMoonDay(k)
  return sunLongitudeSector(nm) >= 9 ? newMoonDay(k - 1) : nm
}

// In a 13-month year, the leap month is the first one with no major solar term.
function leapMonthOffset(a11: number) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last: number
  let i = 1
  let arc = sunLongitudeSector(newMoonDay(k + i))
  do {
    last = arc
    i++
    arc = sunLongitudeSector(newMoonDay(k + i))
  } while (arc !== last && i < 14)
  return i - 1
}

export type LunarDate = { day: number; month: number; year: number; leap: boolean }

const cache = new Map<string, LunarDate>()

// Lunar date of a local calendar day (time of day is ignored).
export function toLunar(date: Date): LunarDate {
  const dd = date.getDate()
  const mm = date.getMonth() + 1
  const yy = date.getFullYear()
  const key = `${yy}-${mm}-${dd}`
  const cached = cache.get(key)
  if (cached) return cached

  const dayNumber = jdFromDate(dd, mm, yy)
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = newMoonDay(k + 1)
  if (monthStart > dayNumber) monthStart = newMoonDay(k)

  let a11 = lunarMonth11(yy)
  let b11 = a11
  let year: number
  if (a11 >= monthStart) {
    year = yy
    a11 = lunarMonth11(yy - 1)
  } else {
    year = yy + 1
    b11 = lunarMonth11(yy + 1)
  }

  const day = dayNumber - monthStart + 1
  const diff = Math.floor((monthStart - a11) / 29)
  let leap = false
  let month = diff + 11
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11)
    if (diff >= leapDiff) {
      month = diff + 10
      leap = diff === leapDiff
    }
  }
  if (month > 12) month -= 12
  if (month >= 11 && diff < 4) year -= 1

  const result = { day, month, year, leap }
  cache.set(key, result)
  return result
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi']

// 2026 → "Bính Ngọ"
export const lunarYearName = (year: number) => `${CAN[(year + 6) % 10]} ${CHI[(year + 8) % 12]}`

// "12/9", leap months marked "1/6N"
export const formatLunar = (l: LunarDate) => `${l.day}/${l.month}${l.leap ? 'N' : ''}`

const HOLIDAYS: Record<string, string> = {
  '1/1': 'Tết Nguyên Đán',
  '2/1': 'Tết',
  '3/1': 'Tết',
  '15/1': 'Rằm tháng Giêng',
  '10/3': 'Giỗ Tổ Hùng Vương',
  '15/4': 'Phật Đản',
  '5/5': 'Tết Đoan Ngọ',
  '15/7': 'Vu Lan',
  '15/8': 'Tết Trung Thu',
  '23/12': 'Ông Công Ông Táo',
}

// Lunar holiday on this day, if any. Leap months repeat a month number but not its holidays.
export function lunarHoliday(date: Date): string | undefined {
  const l = toLunar(date)
  if (l.leap) return undefined
  if (l.month === 12) {
    // Giao thừa = last day of month 12 (29th or 30th): tomorrow is 1/1.
    const next = toLunar(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1))
    if (next.day === 1 && next.month === 1) return 'Giao thừa'
  }
  return HOLIDAYS[`${l.day}/${l.month}`]
}
