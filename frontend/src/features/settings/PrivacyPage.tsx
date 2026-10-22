import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Download, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormError, TextField } from '@/components/shared/form-fields'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { clearOfflineData, persister, queryClient } from '@/app/query-client'
import { api, tokenStore } from '@/lib/api-client'
import { useOnlineStatus } from '@/hooks/use-online-status'

// /app/settings/privacy (spec §8): export data as JSON, clear this device's cache, delete the account.
export function PrivacyPage() {
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()

  async function exportData() {
    setExporting(true)
    try {
      const data = await api<unknown>('/privacy/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = Object.assign(document.createElement('a'), { href: url, download: `lifehub-export-${new Date().toISOString().slice(0, 10)}.json` })
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xuất được dữ liệu')
    } finally {
      setExporting(false)
    }
  }

  // Unsynced writes (outbox) are kept: only the cached server data is dropped, then reloaded from the network.
  async function clearCache() {
    queryClient.removeQueries()
    await persister.removeClient()
    window.location.reload()
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault()
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await api('/me', { method: 'DELETE', body: { password } })
      tokenStore.clear()
      await clearOfflineData()
      navigate('/login', { replace: true })
      toast.success('Đã xoá tài khoản và toàn bộ dữ liệu')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Không xoá được tài khoản')
      setDeleting(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {!online && <FormError message="Bạn đang offline. Xuất dữ liệu và xoá tài khoản cần có mạng." />}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Xuất dữ liệu</h2>
        <p className="text-xs text-muted-foreground">Tải về một file JSON chứa toàn bộ công việc, lịch, tài chính và lịch sử AI Coach của bạn.</p>
        <Button variant="outline" className="self-start" disabled={!online || exporting} onClick={exportData}>
          <Download />
          {exporting ? 'Đang chuẩn bị…' : 'Tải file JSON'}
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Dữ liệu offline trên máy này</h2>
        <p className="text-xs text-muted-foreground">
          Xoá bản sao dữ liệu lưu trên thiết bị rồi tải lại từ máy chủ. Thay đổi chưa đồng bộ vẫn được giữ.
        </p>
        <Button variant="outline" className="self-start" disabled={!online} onClick={clearCache}>
          <RefreshCw />
          Xoá cache và tải lại
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-card p-4">
        <h2 className="text-sm font-semibold text-destructive">Xoá tài khoản</h2>
        <p className="text-xs text-muted-foreground">Xoá vĩnh viễn tài khoản và mọi dữ liệu. Không thể hoàn tác — nên xuất dữ liệu trước.</p>
        <Button variant="destructive" className="self-start" disabled={!online} onClick={() => setDeleteOpen(true)}>
          <Trash2 />
          Xoá tài khoản
        </Button>
      </section>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent>
          <form onSubmit={deleteAccount} className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Xoá vĩnh viễn tài khoản?</AlertDialogTitle>
              <AlertDialogDescription>Nhập mật khẩu để xác nhận. Mọi dữ liệu sẽ bị xoá khỏi máy chủ và thiết bị này.</AlertDialogDescription>
            </AlertDialogHeader>
            <TextField label="Mật khẩu" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <FormError message={deleteError} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={deleting}>
                Huỷ
              </AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={deleting || !password}>
                {deleting ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
