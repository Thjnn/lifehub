// WMO weather codes used by Open-Meteo → Vietnamese label. https://open-meteo.com/en/docs (WMO Weather interpretation codes)
export function weatherLabel(code: number) {
  if (code === 0) return 'Trời quang'
  if (code <= 2) return 'Ít mây'
  if (code === 3) return 'Nhiều mây'
  if (code <= 48) return 'Sương mù'
  if (code <= 57) return 'Mưa phùn'
  if (code <= 67) return 'Mưa'
  if (code <= 77) return 'Tuyết'
  if (code <= 82) return 'Mưa rào'
  if (code <= 86) return 'Mưa tuyết'
  return 'Dông'
}
