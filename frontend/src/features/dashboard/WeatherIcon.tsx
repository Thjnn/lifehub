import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react'

// Static switch rather than picking a component at render time (React static-components rule).
export function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code === 0) return <Sun className={className} aria-hidden />
  if (code <= 2) return <CloudSun className={className} aria-hidden />
  if (code === 3) return <Cloud className={className} aria-hidden />
  if (code <= 48) return <CloudFog className={className} aria-hidden />
  if (code <= 57) return <CloudDrizzle className={className} aria-hidden />
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain className={className} aria-hidden />
  if (code <= 86) return <CloudSnow className={className} aria-hidden />
  return <CloudLightning className={className} aria-hidden />
}
