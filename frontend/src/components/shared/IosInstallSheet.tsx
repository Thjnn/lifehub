import { Share, SquarePlus } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const steps = [
  { icon: Share, text: 'Bấm nút Chia sẻ trên thanh công cụ của Safari' },
  { icon: SquarePlus, text: 'Chọn "Thêm vào MH chính" (Add to Home Screen)' },
  { icon: null, text: 'Bấm "Thêm" — LIFEHUB sẽ xuất hiện như một ứng dụng' },
]

// iOS has no install API, so we explain the manual steps (spec §6.1).
export function IosInstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Cài LIFEHUB trên iPhone/iPad</SheetTitle>
          <SheetDescription>Mở trang này bằng Safari rồi làm theo 3 bước.</SheetDescription>
        </SheetHeader>
        <ol className="flex flex-col gap-3 px-4 pb-6">
          {steps.map(({ icon: Icon, text }, index) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold">
                {index + 1}
              </span>
              <span className="flex-1">{text}</span>
              {Icon && <Icon className="size-5 text-primary" aria-hidden />}
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  )
}
