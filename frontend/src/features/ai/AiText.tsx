import { parseAiText } from '@/features/ai/ai-text'
import { cn } from '@/lib/utils'

// Renders AI output as React text nodes only (escaped by React) — see ai-text.ts.
export function AiText({ text, className }: { text: string; className?: string }) {
  const blocks = parseAiText(text)

  return (
    <div className={cn('flex flex-col gap-1.5 text-sm leading-relaxed', className)}>
      {blocks.map((block, i) => {
        const content = block.spans.map((s, j) => (s.bold ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>))
        return block.kind === 'bullet' ? (
          <p key={i} className="flex gap-2">
            <span className="text-primary" aria-hidden>
              •
            </span>
            <span>{content}</span>
          </p>
        ) : (
          <p key={i}>{content}</p>
        )
      })}
    </div>
  )
}
