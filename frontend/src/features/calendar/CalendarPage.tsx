import { useMemo, useState } from 'react'
import type { DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core'
import viLocale from '@fullcalendar/core/locales/vi'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Moon, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { calendarTasksQuery, eventsQuery, type EventType, type Occurrence } from '@/features/calendar/api'
import { EventFormSheet, type NewEventDefaults } from '@/features/calendar/EventFormSheet'
import { eventTypeColor, eventTypeOptions } from '@/features/calendar/labels'
import { LunarDayCell, LunarDayHeader } from '@/features/calendar/lunar-render'
import type { Task } from '@/features/tasks/api'
import { isOverdue } from '@/features/tasks/labels'
import { TaskFormSheet } from '@/features/tasks/TaskFormSheet'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { formatLunar, lunarYearName, toLunar } from '@/lib/lunar'
import { cn } from '@/lib/utils'

type Range = { from: string; to: string }

// Per-device preference; storage can be unavailable (private mode), so fall back to "on".
const LUNAR_KEY = 'lifehub.calendar.lunar'
function readLunarPref() {
  try {
    return localStorage.getItem(LUNAR_KEY) !== 'off'
  } catch {
    return true
  }
}
function writeLunarPref(on: boolean) {
  try {
    localStorage.setItem(LUNAR_KEY, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

function todayLunarCaption() {
  const lunar = toLunar(new Date())
  return `Hôm nay ${formatLunar(lunar)} âm lịch, năm ${lunarYearName(lunar.year)}`
}

export function CalendarPage() {
  const online = useOnlineStatus()
  const isDesktop = useIsDesktop()
  const [params, setParams] = useSearchParams()

  // FullCalendar reports the visible range; we fetch exactly that (keepPreviousData avoids flashing empty while paging).
  const [range, setRange] = useState<Range>()
  const events = useQuery({ ...eventsQuery(range?.from ?? '', range?.to ?? ''), enabled: !!range, placeholderData: keepPreviousData })
  const tasks = useQuery({ ...calendarTasksQuery(range?.from ?? '', range?.to ?? ''), enabled: !!range, placeholderData: keepPreviousData })

  const [hiddenTypes, setHiddenTypes] = useState<EventType[]>([])
  const [showLunar, setShowLunar] = useState(readLunarPref)
  const [lunarCaption] = useState(todayLunarCaption)
  const [editing, setEditing] = useState<Occurrence>()
  const [editingTask, setEditingTask] = useState<Task>()
  const [newSlot, setNewSlot] = useState<NewEventDefaults>()
  const creating = params.get('new') === '1' || newSlot !== undefined

  const calendarItems = useMemo<EventInput[]>(() => {
    const occurrences = (events.data ?? [])
      .filter((o) => !hiddenTypes.includes(o.event_type))
      .map((o) => ({
        id: o.key,
        title: o.title,
        start: o.start_at,
        end: o.end_at,
        backgroundColor: eventTypeColor(o.event_type),
        borderColor: eventTypeColor(o.event_type),
        textColor: '#0B0D12',
        classNames: o.status === 'cancelled' ? ['lh-cancelled'] : o.status === 'completed' ? ['lh-done'] : [],
        extendedProps: { kind: 'event', occurrence: o },
      }))
    // Tasks: a separate item style (outlined, "☐"/"✓"), never merged with events (spec §9.2).
    const deadlines = (tasks.data ?? []).map((t) => ({
      id: `task-${t.id}`,
      title: `${t.status === 'completed' ? '✓' : '☐'} ${t.title}`,
      start: t.due_at!,
      allDay: false,
      display: 'list-item',
      classNames: ['lh-task', isOverdue(t) ? 'lh-overdue' : '', t.status === 'completed' ? 'lh-done' : ''],
      extendedProps: { kind: 'task', task: t },
    }))
    return [...occurrences, ...deadlines]
  }, [events.data, tasks.data, hiddenTypes])

  function handleDatesSet(arg: DatesSetArg) {
    const next = { from: arg.start.toISOString(), to: arg.end.toISOString() }
    setRange((prev) => (prev?.from === next.from && prev?.to === next.to ? prev : next))
  }

  function handleEventClick(info: EventClickArg) {
    const { kind, occurrence, task } = info.event.extendedProps
    if (kind === 'task') setEditingTask(task)
    else setEditing(occurrence)
  }

  // Click an empty slot to create: 1h in time views, 09:00–10:00 on a month-view day.
  function handleDateClick(info: DateClickArg) {
    if (!online) return
    const start = new Date(info.date)
    if (info.allDay) start.setHours(9, 0, 0, 0)
    setNewSlot({ start, end: new Date(start.getTime() + 3_600_000) })
  }

  function closeEventSheet() {
    setEditing(undefined)
    setNewSlot(undefined)
    if (params.get('new'))
      setParams((prev) => {
        prev.delete('new')
        return prev
      })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {eventTypeOptions.map(({ value, label, color }) => {
          const hidden = hiddenTypes.includes(value)
          return (
            <button
              key={value}
              type="button"
              aria-pressed={!hidden}
              onClick={() => setHiddenTypes((prev) => (hidden ? prev.filter((t) => t !== value) : [...prev, value]))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity',
                hidden && 'opacity-40',
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              {label}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={showLunar}
          onClick={() => {
            writeLunarPref(!showLunar)
            setShowLunar(!showLunar)
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            showLunar ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground',
          )}
        >
          <Moon className="size-3.5" aria-hidden />
          Âm lịch
        </button>
        <Button
          className="ml-auto"
          disabled={!online}
          onClick={() =>
            setParams((prev) => {
              prev.set('new', '1')
              return prev
            })
          }
        >
          <Plus />
          Thêm
        </Button>
      </div>

      {showLunar && <p className="-mt-1 text-xs text-muted-foreground">{lunarCaption}</p>}
      {events.isError && <p className="text-sm text-destructive">{events.error.message}</p>}

      <div className={cn('lh-calendar rounded-xl border bg-card p-2 sm:p-4', (events.isFetching || tasks.isFetching) && 'opacity-80')}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={viLocale}
          firstDay={1}
          initialView={isDesktop ? 'timeGridWeek' : 'listWeek'}
          headerToolbar={
            isDesktop
              ? { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek' }
              : { left: 'prev,next', center: 'title', right: 'today' }
          }
          footerToolbar={isDesktop ? undefined : { center: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek' }}
          buttonText={{ list: 'Danh sách' }}
          height={isDesktop ? 'calc(100dvh - 15rem)' : 'auto'}
          allDaySlot={false}
          nowIndicator
          scrollTime="07:00:00"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          noEventsText="Không có sự kiện nào"
          // List view: one "Thứ Hai, 02/11" header (no side text) so the lunar date fits beside it.
          listDayFormat={{ weekday: 'long', day: '2-digit', month: '2-digit' }}
          listDaySideFormat={false}
          dayCellContent={(arg) => <LunarDayCell arg={arg} showLunar={showLunar} />}
          dayHeaderContent={(arg) => <LunarDayHeader arg={arg} showLunar={showLunar} />}
          events={calendarItems}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
        />
      </div>

      <EventFormSheet
        open={creating || editing !== undefined}
        onOpenChange={(open) => !open && closeEventSheet()}
        occurrence={editing}
        defaults={newSlot}
      />
      <TaskFormSheet open={editingTask !== undefined} onOpenChange={(open) => !open && setEditingTask(undefined)} task={editingTask} />
    </div>
  )
}
