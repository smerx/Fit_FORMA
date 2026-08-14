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
import type { LessonStatus, PayKind, TutorLesson, TutorSettings, TutorStudent } from './types'
import { defaultTutorSettings } from './types'
import { packSize, usedInPack } from './money'
import { syncLessonReminders } from './remind'
import {
  deleteLessonRow,
  deleteStudentRow,
  fetchTutorBundle,
  upsertLessonRow,
  upsertStudentRow,
  upsertTutorSettings,
} from './cloud'

const KEY = 'forma-tutors-v1'

type Bundle = {
  settings: TutorSettings
  students: TutorStudent[]
  lessons: TutorLesson[]
}

const empty: Bundle = {
  settings: defaultTutorSettings(),
  students: [],
  lessons: [],
}

function loadLocal(): Bundle {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Bundle>
    return {
      settings: { ...defaultTutorSettings(), ...parsed.settings },
      students: parsed.students ?? [],
      lessons: parsed.lessons ?? [],
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
  saveSettings: (patch: Partial<TutorSettings>) => Promise<void>
  saveStudent: (input: Omit<TutorStudent, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  removeStudent: (id: string) => Promise<void>
  setLesson: (studentId: string, date: string, status: LessonStatus | null) => Promise<void>
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
          students: remote.students.length ? remote.students : local.students,
          lessons: remote.lessons.length ? remote.lessons : local.lessons,
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
      const row: TutorStudent = {
        id: existing?.id ?? nid(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        name: input.name.trim(),
        payKind: input.payKind,
        priceRub: input.priceRub,
        durationMin: input.durationMin,
        weekdays: input.weekdays,
        timeHm: input.timeHm,
        active: input.active,
        packStartedOn: input.packStartedOn,
        note: input.note,
      }
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
      })
      await cloud(async () => {
        if (!userId) return
        await deleteStudentRow(userId, id)
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
          const next = { ...student, packStartedOn: date }
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

  const value = useMemo<TutorsStore>(
    () => ({
      ready,
      open,
      setOpen,
      settings: bundle.settings,
      students: bundle.students,
      lessons: bundle.lessons,
      saveSettings,
      saveStudent,
      removeStudent,
      setLesson,
    }),
    [ready, open, bundle, saveSettings, saveStudent, removeStudent, setLesson],
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
  active: true,
  packStartedOn: today,
  note: '',
})
