// Amounts travel as decimal strings ("150000.00"). Display goes through Intl; any arithmetic uses BigInt cents,
// never floats (0.1 + 0.2 problems).

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const grouped = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

// "1500000.00" → "1.500.000 ₫"
export const formatVnd = (amount: string) => vnd.format(Number(amount))

// "1500000" → "1.500.000" (input display while typing)
export const groupDigits = (digits: string) => (digits ? grouped.format(Number(digits)) : '')

// Whatever the user typed → digits only ("1.500.000 đ" → "1500000"). MVP is whole VND (spec §9.4).
export const parseVndInput = (text: string) => text.replace(/\D/g, '').replace(/^0+(?=\d)/, '')

function toCents(amount: string): bigint {
  const negative = amount.trim().startsWith('-')
  const [whole, fraction = ''] = amount.replace('-', '').split('.')
  const cents = BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2))
  return negative ? -cents : cents
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`
}

// Exact sum of decimal strings: ["0.10", "0.20"] → "0.30"
export const sumMoney = (amounts: string[]) => fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0n))
