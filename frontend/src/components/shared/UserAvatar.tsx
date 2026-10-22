import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { User } from '@/features/auth/api'

// "Nguyễn Văn Minh" → "VM"
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

// Photo if set, initials otherwise (also while the photo loads).
export function UserAvatar({ user, className }: { user?: Pick<User, 'name' | 'avatar'>; className?: string }) {
  return (
    <Avatar className={className}>
      {user?.avatar && <AvatarImage src={user.avatar} alt="" />}
      <AvatarFallback>{user ? initials(user.name) : '…'}</AvatarFallback>
    </Avatar>
  )
}
