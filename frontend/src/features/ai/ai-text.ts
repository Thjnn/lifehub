// Gemini answers in light Markdown. We render a safe subset ourselves — never dangerouslySetInnerHTML (spec §5):
// paragraphs, "-"/"*"/"•" bullets and **bold**. Anything else stays as plain text.

export type AiSpan = { text: string; bold: boolean }
export type AiBlock = { kind: 'bullet' | 'paragraph'; spans: AiSpan[] }

function spans(line: string): AiSpan[] {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }))
}

export function parseAiText(text: string): AiBlock[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bullet = /^([-*•]|\d+\.)\s+/.exec(line)
      return bullet ? { kind: 'bullet', spans: spans(line.slice(bullet[0].length)) } : { kind: 'paragraph', spans: spans(line.replace(/^#+\s*/, '')) }
    })
}
