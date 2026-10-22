import { ArrowLeftRight, Banknote, BookOpen, CreditCard, HandCoins, Landmark, Smartphone, Bus, Dumbbell, Ellipsis, Gamepad2, House, Tag, Utensils, Wallet, type LucideIcon } from 'lucide-react'
import type { AccountType, Category } from '@/features/finance/api'
import { cn } from '@/lib/utils'

// Icons named by the system categories (migration). Custom categories fall back to a tag.
const categoryIcons: Record<string, LucideIcon> = {
  utensils: Utensils,
  'book-open': BookOpen,
  house: House,
  bus: Bus,
  dumbbell: Dumbbell,
  'gamepad-2': Gamepad2,
  ellipsis: Ellipsis,
  wallet: Wallet,
}

export function CategoryIcon({ category, transfer, className }: { category?: Category; transfer?: boolean; className?: string }) {
  const Icon = transfer ? ArrowLeftRight : (category?.icon && categoryIcons[category.icon]) || Tag
  const color = transfer ? '#9CA3AF' : (category?.color ?? '#9CA3AF')

  return (
    <span
      className={cn('grid size-9 shrink-0 place-items-center rounded-full', className)}
      style={{ backgroundColor: `${color}26`, color }}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  )
}

// Static switch (no component picked at render time — keeps React's static-components rule happy).
export function AccountTypeIcon({ type, className }: { type: AccountType; className?: string }) {
  switch (type) {
    case 'cash':
      return <Banknote className={className} aria-hidden />
    case 'bank':
      return <Landmark className={className} aria-hidden />
    case 'ewallet':
      return <Smartphone className={className} aria-hidden />
    case 'liability':
      return <CreditCard className={className} aria-hidden />
    case 'receivable':
      return <HandCoins className={className} aria-hidden />
  }
}
