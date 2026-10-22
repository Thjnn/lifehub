import { expect, it } from 'vitest'
import { formatLunar, lunarHoliday, lunarYearName, toLunar } from '@/lib/lunar'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

it('finds Tết (1/1) on the known dates', () => {
  const tet: [number, number, number][] = [
    [2020, 1, 25],
    [2021, 2, 12],
    [2022, 2, 1],
    [2023, 1, 22],
    [2024, 2, 10],
    [2025, 1, 29],
    [2026, 2, 17],
    [2027, 2, 6],
    [2028, 1, 26],
    [2029, 2, 13],
  ]
  for (const [y, m, day] of tet) {
    expect(toLunar(d(y, m, day))).toEqual({ day: 1, month: 1, year: y, leap: false })
  }
})

it('uses Vietnam time (UTC+7), not China (UTC+8)', () => {
  // Years where Vietnamese and Chinese New Year differ
  expect(toLunar(d(1985, 1, 21))).toMatchObject({ day: 1, month: 1, year: 1985 })
  expect(toLunar(d(2007, 2, 17))).toMatchObject({ day: 1, month: 1, year: 2007 })
  // New moon 2030-02-02 16:07 UTC = 23:07 in Vietnam (still the 2nd), 00:07 on the 3rd in China
  expect(toLunar(d(2030, 2, 2))).toMatchObject({ day: 1, month: 1, year: 2030 })
})

it('handles leap months', () => {
  expect(toLunar(d(2023, 3, 22))).toEqual({ day: 1, month: 2, year: 2023, leap: true }) // nhuận tháng 2 Quý Mão
  expect(toLunar(d(2025, 7, 25))).toEqual({ day: 1, month: 6, year: 2025, leap: true }) // nhuận tháng 6 Ất Tỵ
  expect(toLunar(d(2025, 6, 25))).toEqual({ day: 1, month: 6, year: 2025, leap: false })
  expect(toLunar(d(2025, 8, 23))).toMatchObject({ day: 1, month: 7, leap: false })
  expect(formatLunar(toLunar(d(2025, 7, 25)))).toBe('1/6N')
})

it('names years and holidays', () => {
  expect(lunarYearName(2026)).toBe('Bính Ngọ')
  expect(lunarYearName(2025)).toBe('Ất Tỵ')
  expect(lunarHoliday(d(2025, 10, 6))).toBe('Tết Trung Thu')
  expect(lunarHoliday(d(2026, 2, 16))).toBe('Giao thừa')
  expect(lunarHoliday(d(2026, 2, 17))).toBe('Tết Nguyên Đán')
  // Rằm of the leap 6th month is not Vu Lan; Vu Lan is 15/7 (2025-09-06)
  expect(lunarHoliday(d(2025, 8, 8))).toBeUndefined()
  expect(lunarHoliday(d(2025, 9, 6))).toBe('Vu Lan')
})
