import type { City } from '@/features/auth/api'

/**
 * Open-Meteo called from the browser (spec §15.5). It allows CORS and limits requests per IP: from the server every
 * user shared Render's IP, which other apps exhausted ("Daily API request limit exceeded"). From the browser each
 * user uses their own quota. Only the chosen city's coordinates are sent — never the device location.
 */

export type Weather = {
  city: string
  current: { temperature: number; feels_like: number; weather_code: number; precipitation: number }
  hourly: { time: string; temperature: number; precipitation_probability: number; weather_code: number }[]
  daily: { date: string; weather_code: number; max: number; min: number; precipitation_probability: number }[]
}

export type CityResult = City & { region: string | null; country: string | null }

type ForecastResponse = {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; precipitation: number }
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[] }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
  }
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Không kết nối được dịch vụ thời tiết.')
  }
  if (res.status === 429) throw new Error('Dịch vụ thời tiết đang giới hạn lượt gọi, thử lại sau.')
  if (!res.ok) throw new Error('Không tải được thời tiết lúc này, thử lại sau.')
  return res.json()
}

const pad = (n: number) => String(n).padStart(2, '0')

// "2026-10-22T15:00" for the current hour in a timezone (Open-Meteo's hourly series uses local times like this).
function localHour(timezone: string, now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${pad(Number(parts.hour))}:00`
}

export async function fetchForecast(city: City, timezone: string, now = new Date()): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    timezone,
    forecast_days: '3',
    current: 'temperature_2m,apparent_temperature,weather_code,precipitation',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  })
  const data = await getJson<ForecastResponse>(`https://api.open-meteo.com/v1/forecast?${params}`)

  // Next 12 hours from the current local hour (the hourly series starts at local midnight today).
  const start = Math.max(0, data.hourly.time.indexOf(localHour(timezone, now)))
  const hours = data.hourly.time.slice(start, start + 12)

  return {
    city: city.name,
    current: {
      temperature: data.current.temperature_2m,
      feels_like: data.current.apparent_temperature,
      weather_code: data.current.weather_code,
      precipitation: data.current.precipitation,
    },
    hourly: hours.map((time, i) => ({
      time,
      temperature: data.hourly.temperature_2m[start + i],
      precipitation_probability: data.hourly.precipitation_probability[start + i],
      weather_code: data.hourly.weather_code[start + i],
    })),
    daily: data.daily.time.map((date, i) => ({
      date,
      weather_code: data.daily.weather_code[i],
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
      precipitation_probability: data.daily.precipitation_probability_max[i],
    })),
  }
}

type GeocodingResponse = { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] }

export async function searchCities(query: string): Promise<CityResult[]> {
  const params = new URLSearchParams({ name: query, count: '6', language: 'vi', format: 'json' })
  const data = await getJson<GeocodingResponse>(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  return (data.results ?? []).map((r) => ({
    name: r.name,
    region: r.admin1 ?? null,
    country: r.country ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
  }))
}
