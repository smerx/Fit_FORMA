import { supabase } from '../lib/supabase'
import type { LessonStatus, PayKind, TutorLesson, TutorSettings, TutorStudent } from './types'
import { defaultTutorSettings } from './types'

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
  active: boolean
  pack_started_on: string | null
  note: string | null
  created_at: string
}

type LessonRow = {
  id: string
  student_id: string
  held_on: string
  status: LessonStatus
  created_at: string
}

function mapStudent(r: StudentRow): TutorStudent {
  return {
    id: r.id,
    name: r.name,
    payKind: r.pay_kind,
    priceRub: r.price_rub,
    durationMin: r.duration_min,
    weekdays: r.weekdays ?? [],
    timeHm: r.time_hm ?? '16:00',
    active: r.active,
    packStartedOn: r.pack_started_on,
    note: r.note ?? '',
    createdAt: r.created_at,
  }
}

export async function fetchTutorBundle(userId: string): Promise<{
  settings: TutorSettings
  students: TutorStudent[]
  lessons: TutorLesson[]
} | null> {
  if (!supabase) return null
  const [setRes, stRes, lesRes] = await Promise.all([
    supabase.from('tutor_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('tutor_students').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('tutor_lessons').select('*').eq('user_id', userId).order('held_on', { ascending: false }),
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
      : ((lesRes.data ?? []) as LessonRow[]).map((r) => ({
          id: r.id,
          studentId: r.student_id,
          date: r.held_on,
          status: r.status,
          createdAt: r.created_at,
        })),
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
  const { error } = await supabase.from('tutor_students').upsert({
    id: s.id,
    user_id: userId,
    name: s.name,
    pay_kind: s.payKind,
    price_rub: s.priceRub,
    duration_min: s.durationMin,
    weekdays: s.weekdays,
    time_hm: s.timeHm,
    active: s.active,
    pack_started_on: s.packStartedOn,
    note: s.note,
    created_at: s.createdAt,
  })
  if (error) throw error
}

export async function deleteStudentRow(userId: string, id: string) {
  if (!supabase) return
  await supabase.from('tutor_lessons').delete().eq('student_id', id).eq('user_id', userId)
  const { error } = await supabase.from('tutor_students').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function upsertLessonRow(userId: string, l: TutorLesson) {
  if (!supabase) return
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
