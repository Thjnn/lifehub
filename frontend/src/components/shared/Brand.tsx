import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <img src="/icons/logo.svg" alt="" className="size-7" />
      <span>LIFEHUB</span>
    </Link>
  )
}
