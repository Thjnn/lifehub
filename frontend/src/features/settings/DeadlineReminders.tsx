import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { currentSubscription, disablePush, enablePush, needsHomeScreenInstall, pushSupported } from '@/features/settings/push'
import { useOnlineStatus } from '@/hooks/use-online-status'

// "Nhắc hạn chót" (spec §15.2): this device gets one combined reminder around 08:00 and 20:00.
export function DeadlineReminders() {
  const online = useOnlineStatus()
  const [enabled, setEnabled] = useState<boolean>()
  const [pending, setPending] = useState(false)
  const supported = pushSupported()

  useEffect(() => {
    void currentSubscription().then((s) => setEnabled(s !== null))
  }, [])

  async function toggle(on: boolean) {
    setPending(true)
    try {
      await (on ? enablePush() : disablePush())
      setEnabled(on)
      toast.success(on ? 'Đã bật nhắc hạn chót trên thiết bị này' : 'Đã tắt nhắc hạn chót trên thiết bị này')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đổi được cài đặt thông báo')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <BellRing className="size-4" aria-hidden />
        Nhắc hạn chót
      </h2>
      <p className="text-xs text-muted-foreground">
        Khoảng 08:00 và 20:00 (theo múi giờ bên dưới), nếu có việc chưa xong đến hạn trong 3 ngày tới, bạn nhận một thông báo gộp. Bật riêng trên từng thiết bị.
      </p>
      {!supported ? (
        <p className="text-sm text-muted-foreground">Trình duyệt này không hỗ trợ thông báo đẩy.</p>
      ) : needsHomeScreenInstall() ? (
        <p className="text-sm text-muted-foreground">Trên iPhone/iPad: bấm Chia sẻ → "Thêm vào MH chính", mở LIFEHUB từ màn hình chính rồi bật ở đây (iOS 16.4 trở lên).</p>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={enabled ?? false} disabled={enabled === undefined || pending || !online} onCheckedChange={(checked) => toggle(checked === true)} />
          Nhắc hạn chót trên thiết bị này
        </label>
      )}
    </section>
  )
}
