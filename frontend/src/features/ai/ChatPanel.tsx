import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, MessageSquarePlus, SendHorizontal, WifiOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AiText } from '@/features/ai/AiText'
import { latestConversationQuery, useSendMessage, type ChatMessage, type Proposal } from '@/features/ai/api'
import type { PageContext } from '@/features/ai/page-context'
import { ProposalCard } from '@/features/ai/ProposalCard'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { cn } from '@/lib/utils'

type Turn = ChatMessage & { proposals?: Proposal[]; error?: boolean }

// The "Hỏi LIFEHUB" chat, on the AI Coach page and in each page's floating assistant (with `page`, so the server adds
// that page's data). Both continue the same latest conversation. Online only.
export function ChatPanel({
  title,
  intro,
  suggestions,
  page,
  onClose,
  className,
}: {
  title: string
  intro: string
  suggestions: string[]
  page?: PageContext
  onClose?: () => void
  className?: string
}) {
  const online = useOnlineStatus()
  const latest = useQuery(latestConversationQuery)
  const send = useSendMessage()
  const [draft, setDraft] = useState('')
  // null = start a new conversation; undefined = continue the latest one once loaded
  const [conversationId, setConversationId] = useState<number | null>()
  const [turns, setTurns] = useState<Turn[]>()
  const [remaining, setRemaining] = useState<number>()
  const bottom = useRef<HTMLDivElement>(null)

  // Show the previous conversation until the user starts a new one or sends a message.
  const history: Turn[] =
    turns ??
    (conversationId === null
      ? []
      : (latest.data?.messages.map((m, i, all) => ({
          ...m,
          proposals: i === all.length - 1 ? latest.data?.proposals : undefined,
        })) ?? []))
  const activeConversation = conversationId === null ? undefined : (conversationId ?? latest.data?.conversation_id)

  // Block body on purpose: newer browsers return a Promise from scrollIntoView, and an effect must return
  // nothing or a cleanup function — returning the Promise crashed the app on navigation ("l is not a function").
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [history.length, send.isPending])

  async function ask(message: string) {
    const text = message.trim()
    if (!text || send.isPending) return
    setDraft('')
    const before = [...history, { id: `u-${history.length}`, role: 'user' as const, content: text }]
    setTurns(before)
    try {
      const result = await send.mutateAsync({
        message: text,
        conversation_id: activeConversation,
        ...(page && { page: page.page, month: page.month, date: page.date }),
      })
      setConversationId(result.conversation_id)
      setRemaining(result.remaining_today)
      setTurns([...before, { id: `a-${before.length}`, role: 'assistant', content: result.reply, proposals: result.proposals }])
    } catch (error) {
      setTurns([...before, { id: `e-${before.length}`, role: 'assistant', content: error instanceof Error ? error.message : 'Có lỗi xảy ra.', error: true }])
    }
  }

  function updateProposal(updated: Proposal) {
    setTurns(history.map((t) => (t.proposals ? { ...t, proposals: t.proposals.map((p) => (p.id === updated.id ? updated : p)) } : t)))
  }

  return (
    <section className={cn('flex flex-col rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="mr-auto truncate text-sm font-semibold">{title}</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConversationId(null)
            setTurns(undefined)
          }}
        >
          <MessageSquarePlus />
          Cuộc trò chuyện mới
        </Button>
        {onClose && (
          <Button size="icon-sm" variant="ghost" aria-label="Đóng" onClick={onClose} className="ml-auto">
            <X />
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {history.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{intro}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" disabled={!online} onClick={() => ask(s)} className="rounded-full border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((t) => (
          <div key={t.id} className={cn('flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1', t.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3 py-2',
                t.role === 'user' ? 'bg-primary text-primary-foreground' : t.error ? 'border border-destructive/40 bg-destructive/10 text-destructive' : 'bg-muted',
              )}
            >
              {t.role === 'user' ? <p className="text-sm whitespace-pre-line">{t.content}</p> : <AiText text={t.content} />}
            </div>
            {t.proposals?.map((p) => (
              <div key={p.id} className="w-full max-w-[85%]">
                <ProposalCard proposal={p} onDecided={updateProposal} />
              </div>
            ))}
          </div>
        ))}
        {send.isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {page ? `AI đang xem trang ${page.label}…` : 'AI đang xem dữ liệu của bạn…'}
          </p>
        )}
        <div ref={bottom} />
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(draft)
        }}
      >
        {online ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void ask(draft)
                }
              }}
              maxLength={1000}
              rows={1}
              aria-label="Câu hỏi cho AI"
              placeholder="Hỏi LIFEHUB…"
              className="max-h-32 min-h-10 flex-1 resize-none"
            />
            <Button type="submit" size="icon" aria-label="Gửi" disabled={!draft.trim() || send.isPending}>
              <SendHorizontal />
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="size-4" aria-hidden />
            AI Coach cần có mạng.
          </p>
        )}
      </form>
      {remaining !== undefined && <p className="px-4 pb-2 text-right text-xs text-muted-foreground">Còn {remaining} câu hỏi trong 24 giờ</p>}
    </section>
  )
}
