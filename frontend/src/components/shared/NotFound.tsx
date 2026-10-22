import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-5xl font-semibold text-primary">404</p>
        <p className="text-muted-foreground">Không tìm thấy trang bạn yêu cầu.</p>
        <Button asChild>
          <Link to="/app/dashboard">Về Tổng quan</Link>
        </Button>
      </div>
    </div>
  )
}
