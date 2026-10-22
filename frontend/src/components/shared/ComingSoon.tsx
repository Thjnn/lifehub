import { Construction } from 'lucide-react'
import { usePageTitle } from '@/hooks/use-page-title'

// Placeholder for routes whose feature lands in a later phase (spec §13).
export function ComingSoon() {
  const title = usePageTitle()

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <Construction className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">Tính năng này đang được xây dựng và sẽ có ở phase sau.</p>
    </div>
  )
}
