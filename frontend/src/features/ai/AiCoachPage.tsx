import { ShieldAlert } from 'lucide-react'
import { BriefingCard } from '@/features/ai/BriefingCard'
import { ChatPanel } from '@/features/ai/ChatPanel'

const suggestions = ['Tuần này tôi tiêu bao nhiêu tiền ăn?', 'Chiều nay tôi rảnh lúc nào?', 'Hôm nay tôi nên làm gì trước?', 'Nhắc tôi nộp báo cáo tối thứ Sáu']

// /app/ai-coach (spec §9.5): briefing + "Hỏi LIFEHUB". Online only.
export function AiCoachPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="flex flex-col gap-3">
        <BriefingCard />
        <p className="flex gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          Câu hỏi và số liệu tổng hợp liên quan được gửi tới Google Gemini (gói miễn phí — Google có thể dùng dữ liệu để cải thiện
          dịch vụ). LIFEHUB không gửi danh sách giao dịch chi tiết. AI chỉ đề xuất; mọi thay đổi cần bạn xác nhận.
        </p>
      </div>

      <ChatPanel
        title="Hỏi LIFEHUB"
        intro="Hỏi về lịch, công việc, chi tiêu, ngân sách, khoản nợ hay thời tiết. Ví dụ:"
        suggestions={suggestions}
        className="min-h-[60dvh]"
      />
    </div>
  )
}
