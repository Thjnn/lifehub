import type { EventStatus, EventType } from '@/features/calendar/api'

// Colours from the spec §7 palette (plus one violet for work); text stays dark for contrast on all of them.
export const eventTypeOptions: { value: EventType; label: string; color: string }[] = [
  { value: 'study', label: 'Học tập', color: '#5B8CFF' },
  { value: 'work', label: 'Công việc', color: '#A78BFA' },
  { value: 'workout', label: 'Tập luyện', color: '#34D399' },
  { value: 'rest', label: 'Nghỉ ngơi', color: '#9CA3AF' },
  { value: 'personal', label: 'Cá nhân', color: '#FBBF24' },
]

export const eventStatusOptions: { value: EventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'completed', label: 'Đã xong' },
  { value: 'cancelled', label: 'Đã huỷ' },
]

export const eventTypeColor = (type: EventType) => eventTypeOptions.find((o) => o.value === type)!.color
