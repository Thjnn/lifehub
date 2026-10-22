import { Link } from 'react-router'
import { Brand } from '@/components/shared/Brand'
import { Button } from '@/components/ui/button'

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Brand />
        <Button variant="ghost" asChild>
          <Link to="/login">Đăng nhập</Link>
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Lịch, công việc và tài chính trong một ứng dụng
        </h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          LIFEHUB cho bạn biết việc cần làm tiếp theo, kèm AI Coach gợi ý dựa trên dữ liệu thật. Cài như ứng dụng, dùng
          được cả khi offline.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/register">Bắt đầu miễn phí</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/app/dashboard">Xem ứng dụng</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
