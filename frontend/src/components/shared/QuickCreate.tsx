import type { ReactNode } from 'react'
import { CalendarPlus, ListTodo, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const actions = [
  { label: 'Công việc', icon: ListTodo },
  { label: 'Sự kiện', icon: CalendarPlus },
  { label: 'Giao dịch', icon: Wallet },
]

// Spec §7: quick create task / event / transaction. Forms arrive with each feature's phase.
export function QuickCreate({ trigger }: { trigger: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {actions.map(({ label, icon: Icon }) => (
          <DropdownMenuItem key={label} onSelect={() => toast.info(`Tạo ${label.toLowerCase()} sẽ có ở phase sau`)}>
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
