import type { ReactNode } from 'react'
import { CalendarPlus, ListTodo, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// `to` opens that page's create form via ?new=1; actions without one arrive in later phases.
const actions = [
  { label: 'Công việc', icon: ListTodo, to: '/app/tasks?new=1' },
  { label: 'Sự kiện', icon: CalendarPlus, to: '/app/calendar?new=1' },
  { label: 'Giao dịch', icon: Wallet, to: '/app/finance/transactions?new=1' },
]

// Spec §7: quick create task / event / transaction.
export function QuickCreate({ trigger }: { trigger: ReactNode }) {
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {actions.map(({ label, icon: Icon, to }) => (
          <DropdownMenuItem
            key={label}
            onSelect={() => (to ? navigate(to) : toast.info(`Tạo ${label.toLowerCase()} sẽ có ở phase sau`))}
          >
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
