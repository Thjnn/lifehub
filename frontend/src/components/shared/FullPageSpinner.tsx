import { Loader2 } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Đang tải" />
    </div>
  )
}
