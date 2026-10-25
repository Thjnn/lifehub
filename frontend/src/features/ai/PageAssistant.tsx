import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChatPanel } from '@/features/ai/ChatPanel'
import { pageContextFor } from '@/features/ai/page-context'
import { useIsDesktop } from '@/hooks/use-media-query'

// Floating "Hỏi AI" button on pages that have a context: the chat opens with this page's data on the server side.
// Nothing is sent until the user asks (each question = one Gemini request from the shared daily limit).
export function PageAssistant() {
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const isDesktop = useIsDesktop()
  const context = pageContextFor(pathname, search)
  if (!context) return null

  return (
    <>
      <Button
        size="icon-lg"
        variant="secondary"
        aria-label={`Hỏi AI về trang ${context.label}`}
        onClick={() => setOpen(true)}
        // Mobile: above the "Tạo nhanh" button; desktop: bottom-right corner.
        className="fixed right-5 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-40 size-12 rounded-full border shadow-lg lg:right-8 lg:bottom-8 lg:size-14"
      >
        <Sparkles className="size-5 text-primary" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isDesktop ? 'right' : 'bottom'}
          showCloseButton={false}
          className="flex h-[85dvh] flex-col gap-0 p-0 pb-[env(safe-area-inset-bottom)] max-lg:rounded-t-2xl lg:h-full lg:max-w-md"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Hỏi AI về trang {context.label}</SheetTitle>
            <SheetDescription>AI xem dữ liệu của trang này để gợi ý. Mọi thay đổi đều cần bạn xác nhận.</SheetDescription>
          </SheetHeader>
          <ChatPanel
            title={`Hỏi AI · ${context.label}`}
            intro={`AI sẽ xem dữ liệu trang ${context.label} của bạn để trả lời. Ví dụ:`}
            suggestions={context.suggestions}
            page={context}
            onClose={() => setOpen(false)}
            className="min-h-0 flex-1 rounded-none border-0"
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
