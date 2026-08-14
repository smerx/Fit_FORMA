import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { nid } from '../lib/dates'
import type { LessonStatus, PayKind, TutorEvent, TutorEventKind, TutorLesson, TutorSettings, TutorStudent } from './types'
import { defaultTutorSettings } from './types'
import { hydrateStudent, packSize, usedInPack } from './money'
import { syncLessonReminders } from './remind'
import {
  deleteEventRow,
  deleteLessonRow,
  deleteStudentRow,
  fetchTutorBundle,
  upsertEventRow,
  upsertLessonRow,
  upsertStudentRow,
  upsertTutorSettings,
} from './cloud'

const KEY = 'forma-tutors-v1'

type Bundle = {
  settings: TutorSettings
  students: TutorStudent[]
  lessons: TutorLesson[]
  events: TutorEvent[]
}

const empty: Bundle = {
  settings: defaultTutorSettings(),
  students: [],
  lessons: [],
  events: [],
}

function mergeStudents(local: TutorStudent[], remote: TutorStudent[]): TutorStudent[] {
  if (!remote.length) return local.map((s) => hydrateStudent(s))
  const remoteHasOrder = remote.some((s) => (s.sortOrder ?? 0) > 0)
  const localById = new Map(local.map((s) => [s.id, s]))
  const remoteIds = new Set(remote.map((s) => s.id))
  const merged = remote.map((r) => {
    const l = localById.get(r.id)
    if (!l) return hydrateStudent(r)
    const remoteFlat = new Set(r.slots.map((x) => x.timeHm)).size <= 1
    const localVaried = new Set(l.slots.map((x) => x.timeHm)).size > 1
    const slots = localVaried && remoteFlat ? l.slots : r.slots.length ? r.slots : l.slots
    return hydrateStudent({
      ...r,
      slots,
      sortOrder: remoteHasOrder ? r.sortOrder : (l.sortOrder ?? r.sortOrder ?? 0),
    })
  })
  return [...merged, ...local.filter((s) => !remoteIds.has(s.id)).map((s) => hydrateStudent(s))]
}

function mergeEvents(local: TutorEvent[], remote: TutorEvent[]): TutorEvent[] {
  if (!remote.length) return local
  const map = new Map(remote.map((e) => [e.id, e]))
  for (const l of local) if (!map.has(l.id)) map.set(l.id, l)
  return [...map.values()]
}

function loadLocal(): Bundle {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Bundle>
    return {
      settings: { ...defaultTutorSettings(), ...parsed.settings },
      students: (parsed.students ?? []).map((s) => hydrateStudent(s)),
      lessons: parsed.lessons ?? [],
      events: parsed.events ?? [],
    }
  } catch {
    return empty
  }
}

type TutorsStore = {
  ready: boolean
  open: boolean
  setOpen: (v: boolean) => void
  settings: TutorSettings
  students: TutorStudent[]
  lessons: TutorLesson[]
  events: TutorEvent[]
  saveSettings: (patch: Partial<TutorSettings>) => Promise<void>
  saveStudent: (input: Omit<TutorStudent, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  removeStudent: (id: string) => Promise<void>
  reorderStudents: (orderedIds: string[]) => Promise<void>
  setLesson: (studentId: string, date: string, status: LessonStatus | null) => Promise<void>
  saveEvent: (input: {
    date: string
    kind: TutorEventKind
    studentId: string
    amountRub: number
    id?: string
  }) => Promise<void>
  removeEvent: (id: string) => Promise<void>
}

const Ctx = createContext<TutorsStore | null>(null)

export function TutorsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [bundle, setBundle] = useState<Bundle>(empty)
  const [userId, setUserId] = useState<string | null>(null)

  const commit = useCallback((next: Bundle) => {
    setBundle(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }, [])

  useEffect(() => {
    setBundle(loadLocal())
    setReady(true)
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchTutorBundle(userId)
      .then((remote) => {
        if (cancelled || !remote) return
        const local = loadLocal()
        commit({
          settings: { ...defaultTutorSettings(), ...local.settings, ...remote.settings },
          students: mergeStudents(local.students, remote.students),
          lessons: remote.lessons.length ? remote.lessons : local.lessons,
          events: mergeEvents(local.events, remote.events),
        })
      })
      .catch(() => {
        /* ученики остаются локальными, еда не падает */
      })
    return () => {
      cancelled = true
    }
  }, [userId, commit])

  useEffect(() => {
    const on = bundle.settings.enabled && bundle.settings.remindersOn
    syncLessonReminders(bundle.students, bundle.lessons, on)
    const vis = () => {
      if (document.visibilityState === 'visible') {
        syncLessonReminders(bundle.students, bundle.lessons, on)
      }
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('visibilitychange', vis)
    }
  }, [bundle.settings.enabled, bundle.settings.remindersOn, bundle.students, bundle.lessons])

  const cloud = useCallback(
    async (fn: () => Promise<void>) => {
      if (!userId) return
      try {
        await fn()
      } catch {
        /* не роняем дневник */
      }
    },
    [userId],
  )

  const saveSettings = useCallback(
    async (patch: Partial<TutorSettings>) => {
      const settings = { ...bundle.settings, ...patch }
      commit({ ...bundle, settings })
      await cloud(async () => {
        if (!userId) return
        await upsertTutorSettings(userId, settings)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const saveStudent = useCallback(
    async (input: Omit<TutorStudent, 'id' | 'createdAt'> & { id?: string }) => {
      const existing = input.id ? bundle.students.find((s) => s.id === input.id) : undefined
      const nextOrder =
        existing?.sortOrder ??
        input.sortOrder ??
        bundle.students.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1
      const row = hydrateStudent({
        id: existing?.id ?? nid(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        name: input.name.trim(),
        payKind: input.payKind,
        priceRub: input.priceRub,
        durationMin: input.durationMin,
        slots: input.slots,
        weekdays: input.weekdays,
        timeHm: input.timeHm,
        active: input.active,
        packStartedOn: input.packStartedOn,
        note: input.note,
        sortOrder: nextOrder,
      })
      const students = existing
        ? bundle.students.map((s) => (s.id === row.id ? row : s))
        : [...bundle.students, row]
      commit({ ...bundle, students })
      await cloud(async () => {
        if (!userId) return
        await upsertStudentRow(userId, row)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const removeStudent = useCallback(
    async (id: string) => {
      commit({
        ...bundle,
        students: bundle.students.filter((s) => s.id !== id),
        lessons: bundle.lessons.filter((l) => l.studentId !== id),
        events: bundle.events.filter((e) => e.studentId !== id),
      })
      await cloud(async () => {
        if (!userId) return
        await deleteStudentRow(userId, id)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const reorderStudents = useCallback(
    async (orderedIds: string[]) => {
      const byId = new Map(bundle.students.map((s) => [s.id, s]))
      const seen = new Set(orderedIds)
      const students = [
        ...orderedIds.flatMap((id, i) => {
          const s = byId.get(id)
          return s ? [hydrateStudent({ ...s, sortOrder: i })] : []
        }),
        ...bundle.students
          .filter((s) => !seen.has(s.id))
          .map((s, i) => hydrateStudent({ ...s, sortOrder: orderedIds.length + i })),
      ]
      commit({ ...bundle, students })
      await cloud(async () => {
        if (!userId) return
        for (const s of students) await upsertStudentRow(userId, s)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const setLesson = useCallback(
    async (studentId: string, date: string, status: LessonStatus | null) => {
      let lessons = bundle.lessons.filter((l) => !(l.studentId === studentId && l.date === date))
      const prev = bundle.lessons.find((l) => l.studentId === studentId && l.date === date)
      if (status) {
        lessons = [
          {
            id: prev?.id ?? nid(),
            studentId,
            date,
            status,
            createdAt: prev?.createdAt ?? new Date().toISOString(),
          },
          ...lessons,
        ]
      }
      let students = bundle.students
      const student = students.find((s) => s.id === studentId)
      const size = student ? packSize(student.payKind) : null
      if (student && size && status && (status === 'held' || status === 'skipped' || status === 'extra')) {
        const used = usedInPack({ ...student }, lessons)
        if (used > size) {
          const next = hydrateStudent({ ...student, packStartedOn: date })
          students = students.map((s) => (s.id === studentId ? next : s))
          await cloud(async () => {
            if (!userId) return
            await upsertStudentRow(userId, next)
          })
        }
      }
      commit({ ...bundle, students, lessons })
      await cloud(async () => {
        if (!userId) return
        const row = lessons.find((l) => l.studentId === studentId && l.date === date)
        if (row) await upsertLessonRow(userId, row)
        else if (prev) await deleteLessonRow(userId, prev.id)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const saveEvent = useCallback(
    async (input: {
      date: string
      kind: TutorEventKind
      studentId: string
      amountRub: number
      id?: string
    }) => {
      const prev = input.id
        ? bundle.events.find((e) => e.id === input.id)
        : bundle.events.find(
            (e) => e.date === input.date && e.studentId === input.studentId && e.kind === input.kind,
          )
      const row: TutorEvent = {
        id: prev?.id ?? nid(),
        date: input.date,
        kind: input.kind,
        studentId: input.studentId,
        amountRub: input.amountRub,
        createdAt: prev?.createdAt ?? new Date().toISOString(),
      }
      const events = [row, ...bundle.events.filter((e) => e.id !== row.id)]
      commit({ ...bundle, events })
      await cloud(async () => {
        if (!userId) return
        await upsertEventRow(userId, row)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const removeEvent = useCallback(
    async (id: string) => {
      commit({ ...bundle, events: bundle.events.filter((e) => e.id !== id) })
      await cloud(async () => {
        if (!userId) return
        await deleteEventRow(userId, id)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const value = useMemo<TutorsStore>(
    () => ({
      ready,
      open,
      setOpen,
      settings: bundle.settings,
      students: bundle.students,
      lessons: bundle.lessons,
      events: bundle.events,
      saveSettings,
      saveStudent,
      removeStudent,
      reorderStudents,
      setLesson,
      saveEvent,
      removeEvent,
    }),
    [
      ready,
      open,
      bundle,
      saveSettings,
      saveStudent,
      removeStudent,
      reorderStudents,
      setLesson,
      saveEvent,
      removeEvent,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTutors(): TutorsStore {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Tutors store missing')
  return ctx
}

export function useTutorsOptional(): TutorsStore | null {
  return useContext(Ctx)
}

export const defaultStudentDraft = (
  today: string,
): Omit<TutorStudent, 'id' | 'createdAt'> => ({
  name: '',
  payKind: 'pack8' as PayKind,
  priceRub: 13000,
  durationMin: 60,
  weekdays: [],
  timeHm: '16:00',
  slots: [{ weekday: 7, timeHm: '16:00' }],
  active: true,
  packStartedOn: today,
  note: '',
  sortOrder: 0,
})
