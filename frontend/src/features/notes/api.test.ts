import { describe, expect, it } from 'vitest'
import { matchesSearch } from './api'

describe('matchesSearch', () => {
  const note = { title: 'Đi chợ', body: 'Mua bánh mì và Sữa tươi' }

  it('ignores case and Vietnamese diacritics, in title and body', () => {
    expect(matchesSearch(note, 'banh mi')).toBe(true)
    expect(matchesSearch(note, 'SỮA')).toBe(true)
    expect(matchesSearch(note, 'di cho')).toBe(true)
    expect(matchesSearch(note, 'trứng')).toBe(false)
  })

  it('matches everything for an empty search', () => {
    expect(matchesSearch({ title: null, body: 'x' }, '  ')).toBe(true)
  })
})
