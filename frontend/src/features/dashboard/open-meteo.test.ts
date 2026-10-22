import { afterEach, expect, it, vi } from 'vitest'
import { fetchForecast, searchCities } from '@/features/dashboard/open-meteo'

afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

// Shape copied from a real Open-Meteo answer (Mỹ Tho, 2026-10-22).
const forecast = {
  current: { time: '2026-10-22T23:00', interval: 900, temperature_2m: 25.6, apparent_temperature: 31.8, weather_code: 0, precipitation: 0 },
  hourly: {
    time: Array.from({ length: 72 }, (_, h) => `2026-10-${22 + Math.floor(h / 24)}T${String(h % 24).padStart(2, '0')}:00`),
    temperature_2m: Array.from({ length: 72 }, (_, h) => 20 + (h % 24) / 2),
    precipitation_probability: Array.from({ length: 72 }, (_, h) => h),
    weather_code: Array.from({ length: 72 }, () => 3),
  },
  daily: {
    time: ['2026-10-22', '2026-10-23', '2026-10-24'],
    weather_code: [0, 61, 80],
    temperature_2m_max: [31, 29, 28],
    temperature_2m_min: [24, 24, 23],
    precipitation_probability_max: [10, 80, 60],
  },
}

it('maps the forecast and starts the hourly strip at the current local hour', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(forecast))
  vi.stubGlobal('fetch', fetchMock)

  // 08:30 UTC = 15:30 in Vietnam
  const weather = await fetchForecast({ name: 'Mỹ Tho', latitude: 10.36, longitude: 106.36 }, 'Asia/Ho_Chi_Minh', new Date('2026-10-22T08:30:00Z'))

  expect(weather.city).toBe('Mỹ Tho')
  expect(weather.current).toEqual({ temperature: 25.6, feels_like: 31.8, weather_code: 0, precipitation: 0 })
  expect(weather.hourly).toHaveLength(12)
  expect(weather.hourly[0]).toEqual({ time: '2026-10-22T15:00', temperature: 27.5, precipitation_probability: 15, weather_code: 3 })
  expect(weather.daily[1]).toEqual({ date: '2026-10-23', weather_code: 61, max: 29, min: 24, precipitation_probability: 80 })

  const url = new URL(fetchMock.mock.calls[0][0])
  expect(url.host).toBe('api.open-meteo.com')
  expect(url.searchParams.get('latitude')).toBe('10.36')
  expect(url.searchParams.get('timezone')).toBe('Asia/Ho_Chi_Minh')
})

it('explains the per-IP daily limit instead of failing silently', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: true, reason: 'Daily API request limit exceeded.' }, 429)))

  await expect(fetchForecast({ name: 'X', latitude: 0, longitude: 0 }, 'UTC')).rejects.toThrow('giới hạn lượt gọi')
})

it('searches cities with the geocoding API', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(json({ results: [{ name: 'Mỹ Tho', admin1: 'Tiền Giang', country: 'Việt Nam', latitude: 10.36004, longitude: 106.35996 }] })),
  )

  expect(await searchCities('My Tho')).toEqual([
    { name: 'Mỹ Tho', region: 'Tiền Giang', country: 'Việt Nam', latitude: 10.36004, longitude: 106.35996 },
  ])
})

it('returns no cities when nothing matches', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ generationtime_ms: 0.1 })))

  expect(await searchCities('zzzz')).toEqual([])
})
