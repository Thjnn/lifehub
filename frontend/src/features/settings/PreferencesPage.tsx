import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { FormError, SelectField } from '@/components/shared/form-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { meQuery } from '@/features/auth/api'
import { useUpdateSettings } from '@/features/dashboard/api'
import { searchCities, type CityResult } from '@/features/dashboard/open-meteo'
import { useOnlineStatus } from '@/hooks/use-online-status'

// Common zones first; the current one is always selectable even if not listed.
const zones = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles']

// /app/settings/preferences (spec §9.6): timezone + weather city (spec §15.5, no geolocation permission).
export function PreferencesPage() {
  const online = useOnlineStatus()
  const me = useQuery(meQuery)
  const update = useUpdateSettings()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CityResult[]>()
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string>()

  const settings = me.data?.settings
  const timezone = settings?.timezone ?? 'Asia/Ho_Chi_Minh'
  const zoneOptions = [...new Set([timezone, ...zones])].map((z) => ({ value: z, label: z.replace('_', ' ') }))

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2) return
    setSearching(true)
    setError(undefined)
    try {
      setResults(await searchCities(query.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tìm được')
    } finally {
      setSearching(false)
    }
  }

  async function save(input: Parameters<typeof update.mutateAsync>[0], message: string) {
    try {
      await update.mutateAsync(input)
      toast.success(message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được')
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {!online && <FormError message="Bạn đang offline. Cần có mạng để đổi cài đặt." />}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Thành phố (thời tiết)</h2>
        <p className="text-xs text-muted-foreground">
          Dùng cho dự báo thời tiết trên Tổng quan. LIFEHUB không xin quyền định vị của thiết bị.
        </p>
        {settings?.city ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" aria-hidden />
              {settings.city.name}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Bỏ thành phố" disabled={!online} onClick={() => save({ city: null }, 'Đã bỏ thành phố')}>
              <X />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa chọn thành phố.</p>
        )}
        <form onSubmit={search} className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="VD: Hà Nội, Đà Nẵng, Cần Thơ" className="h-9 flex-1" />
          <Button type="submit" size="sm" variant="outline" disabled={!online || searching || query.trim().length < 2}>
            <Search />
            Tìm
          </Button>
        </form>
        <FormError message={error} />
        {results && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {results.length === 0 && <li className="p-3 text-sm text-muted-foreground">Không tìm thấy. Thử tên khác (có dấu hoặc không dấu).</li>}
            {results.map((city) => (
              <li key={`${city.latitude},${city.longitude}`}>
                <button
                  type="button"
                  disabled={!online || update.isPending}
                  onClick={async () => {
                    await save({ city: { name: city.name, latitude: city.latitude, longitude: city.longitude } }, `Đã chọn ${city.name}`)
                    setResults(undefined)
                    setQuery('')
                  }}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/40"
                >
                  <span>{city.name}</span>
                  <span className="text-xs text-muted-foreground">{[city.region, city.country].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Múi giờ</h2>
        <p className="text-xs text-muted-foreground">Quyết định "hôm nay", "tháng này" và giờ nhắc nợ. Mặc định giờ Việt Nam.</p>
        <SelectField
          label="Múi giờ"
          value={timezone}
          options={zoneOptions}
          onChange={(value) => online && save({ timezone: value }, 'Đã đổi múi giờ')}
        />
      </section>
    </div>
  )
}
