import { supabase } from '../lib/supabase'
import type { LessonStatus, PayKind, TutorEvent, TutorEventKind, TutorLesson, TutorSettings, TutorStudent } from './types'
import { defaultTutorSettings } from './types'
import { hydrateLesson, hydrateStudent } from './money'

type SettingsRow = {
  enabled: boolean
  reminders_on?: boolean | null
  pay_details?: string | null
}

type StudentRow = {
  id: string
  name: string
  pay_kind: PayKind
  price_rub: number
  duration_min: number
  weekdays: number[] | null
  time_hm: string | null
  schedule?: { weekday: number; timeHm: string }[] | null
  active: boolean
  paid?: boolean | null
  pack_started_on: string | null
  note: string | null
  sort_order?: number | null
  created_at: string
}

type LessonRow = {
  id: string
  student_id: string
  held_on: string
  time_hm?: string | null
  status: LessonStatus
  created_at: string
}

type EventRow = {
  id: string
  student_id: string | null
  happened_on: string
  kind: TutorEventKind
  amount_rub: number
  title?: string | null
  time_hm?: string | null
  created_at: string
}

function mapStudent(r: StudentRow): TutorStudent {
  return hydrateStudent({
    id: r.id,
    name: r.name,
    payKind: r.pay_kind,
    priceRub: r.price_rub,
    durationMin: r.duration_min,
    weekdays: r.weekdays ?? [],
    timeHm: r.time_hm ?? '16:00',
    slots: r.schedule ?? [],
    active: r.active,
    paid: r.paid ?? false,
    packStartedOn: r.pack_started_on,
    note: r.note ?? '',
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at,
  })
}

function mapEvent(r: EventRow): TutorEvent {
  return {
    id: r.id,
    studentId: r.student_id,
    date: r.happened_on,
    kind: r.kind,
    amountRub: r.amount_rub,
    title: r.title ?? '',
    timeHm: r.time_hm ?? null,
    createdAt: r.created_at,
  }
}

export async function fetchTutorBundle(userId: string): Promise<{
  settings: TutorSettings
  students: TutorStudent[]
  lessons: TutorLesson[]
  events: TutorEvent[]
} | null> {
  if (!supabase) return null
  const [setRes, stRes, lesRes, evRes] = await Promise.all([
    supabase.from('tutor_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('tutor_students').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('tutor_lessons').select('*').eq('user_id', userId).order('held_on', { ascending: false }),
    supabase.from('tutor_events').select('*').eq('user_id', userId).order('happened_on', { ascending: false }),
  ])
  if (setRes.error && stRes.error && lesRes.error) return null
  const row = setRes.data as SettingsRow | null
  return {
    settings: row
      ? {
          enabled: row.enabled,
          remindersOn: row.reminders_on ?? true,
          payDetails: row.pay_details || defaultTutorSettings().payDetails,
        }
      : defaultTutorSettings(),
    students: stRes.error ? [] : ((stRes.data ?? []) as StudentRow[]).map(mapStudent),
    lessons: lesRes.error
      ? []
      : ((lesRes.data ?? []) as LessonRow[]).map((r) =>
          hydrateLesson({
            id: r.id,
            studentId: r.student_id,
            date: r.held_on,
            timeHm: r.time_hm ?? '',
            status: r.status,
            createdAt: r.created_at,
          }),
        ),
    events: evRes.error ? [] : ((evRes.data ?? []) as EventRow[]).map(mapEvent),
  }
}

export async function upsertTutorSettings(userId: string, s: TutorSettings) {
  if (!supabase) return
  const { error } = await supabase.from('tutor_settings').upsert({
    user_id: userId,
    enabled: s.enabled,
    reminders_on: s.remindersOn,
    pay_details: s.payDetails,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function upsertStudentRow(userId: string, s: TutorStudent) {
  if (!supabase) return
  const base = {
    id: s.id,
    user_id: userId,
    name: s.name,
    pay_kind: s.payKind,
    price_rub: s.priceRub,
    duration_min: s.durationMin,
    weekdays: s.slots.map((x) => x.weekday),
    time_hm: s.slots[0]?.timeHm ?? s.timeHm,
    active: s.active,
    pack_started_on: s.packStartedOn,
    note: s.note,
    created_at: s.createdAt,
  }
  const withSort = { ...base, sort_order: s.sortOrder, paid: s.paid }
  const full = { ...withSort, schedule: s.slots }
  const first = await supabase.from('tutor_students').upsert(full)
  if (!first.error) return
  const withSchedule = { ...base, schedule: s.slots }
  const second = await supabase.from('tutor_students').upsert(withSchedule)
  if (!second.error) return
  const { error } = await supabase.from('tutor_students').upsert(base)
  if (error) throw error
}

export async function deleteStudentRow(userId: string, id: string) {
  if (!supabase) return
  await supabase.from('tutor_events').delete().eq('student_id', id).eq('user_id', userId)
  await supabase.from('tutor_lessons').delete().eq('student_id', id).eq('user_id', userId)
  const { error } = await supabase.from('tutor_students').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function upsertLessonRow(userId: string, l: TutorLesson) {
  if (!supabase) return
  const full = {
    id: l.id,
    user_id: userId,
    student_id: l.studentId,
    held_on: l.date,
    time_hm: l.timeHm,
    status: l.status,
    created_at: l.createdAt,
  }
  const first = await supabase.from('tutor_lessons').upsert(full)
  if (!first.error) return
  const { error } = await supabase.from('tutor_lessons').upsert({
    id: l.id,
    user_id: userId,
    student_id: l.studentId,
    held_on: l.date,
    status: l.status,
    created_at: l.createdAt,
  })
  if (error) throw error
}

export async function deleteLessonRow(userId: string, id: string) {
  if (!supabase) return
  const { error } = await supabase.from('tutor_lessons').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function upsertEventRow(userId: string, e: TutorEvent) {
  if (!supabase) return
  const full = {
    id: e.id,
    user_id: userId,
    student_id: e.studentId,
    happened_on: e.date,
    kind: e.kind,
    amount_rub: e.amountRub,
    title: e.title,
    time_hm: e.timeHm,
    created_at: e.createdAt,
  }
  const first = await supabase.from('tutor_events').upsert(full)
  if (!first.error) return
  const { error } = await supabase.from('tutor_events').upsert({
    id: e.id,
    user_id: userId,
    student_id: e.studentId,
    happened_on: e.date,
    kind: e.kind,
    amount_rub: e.amountRub,
    created_at: e.createdAt,
  })
  if (error) throw error
}

export async function deleteEventRow(userId: string, id: string) {
  if (!supabase) return
  const { error } = await supabase.from('tutor_events').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function upsertPushSub(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
) {
  if (!supabase) return
  const { error } = await supabase.from('tutor_push_subs').upsert({
    endpoint: sub.endpoint,
    user_id: userId,
    p256dh: sub.p256dh,
    auth: sub.auth,
  })
  if (error) throw error
}

export async function replaceReminderQueue(
  userId: string,
  items: { id: string; fireAt: string; title: string; body: string; tag: string }[],
) {
  if (!supabase) return
  await supabase.from('tutor_reminder_queue').delete().eq('user_id', userId).is('sent_at', null)
  if (!items.length) return
  const { error } = await supabase.from('tutor_reminder_queue').insert(
    items.map((x) => ({
      id: x.id,
      user_id: userId,
      fire_at: x.fireAt,
      title: x.title,
      body: x.body,
      tag: x.tag,
    })),
  )
  if (error) throw error
}
