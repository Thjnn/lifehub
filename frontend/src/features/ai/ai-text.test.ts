import { expect, it } from 'vitest'
import { parseAiText } from '@/features/ai/ai-text'

it('parses bullets, numbered items, bold and headings into safe blocks', () => {
  expect(parseAiText('## Hôm nay\n* Ôn **Toán** lúc 8h\n- Mua đồ\n2. Gym\n\nCố lên!')).toEqual([
    { kind: 'paragraph', spans: [{ text: 'Hôm nay', bold: false }] },
    { kind: 'bullet', spans: [{ text: 'Ôn ', bold: false }, { text: 'Toán', bold: true }, { text: ' lúc 8h', bold: false }] },
    { kind: 'bullet', spans: [{ text: 'Mua đồ', bold: false }] },
    { kind: 'bullet', spans: [{ text: 'Gym', bold: false }] },
    { kind: 'paragraph', spans: [{ text: 'Cố lên!', bold: false }] },
  ])
})

it('keeps HTML as plain text (no injection path)', () => {
  expect(parseAiText('<img src=x onerror=alert(1)>')).toEqual([
    { kind: 'paragraph', spans: [{ text: '<img src=x onerror=alert(1)>', bold: false }] },
  ])
})
