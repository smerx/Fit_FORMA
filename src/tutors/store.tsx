import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { nid } from '../lib/dates'
import type { LessonStatus, PayKind, TutorEvent, TutorEventKind, TutorLesson, TutorSettings, TutorStudent } from './types'
import { defaultTutorSettings } from './types'
import { hydrateLesson, hydrateStudent, packSize, usedInPack } from './money'
import { syncLessonReminders } from './remind'
import { appendTutorSyncLog as logSync } from './diagnostics'
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
const PENDING_KEY = 'forma-tutors-pending-v1'
const BACKUPS_KEY = 'forma-tutors-backups-v1'

type Bundle = {
  settings: TutorSettings
  students: TutorStudent[]
  lessons: TutorLesson[]
  events: TutorEvent[]
}

type TutorBackup = {
  createdAt: string
  bundle: Bundle
}

type PendingTutorMutation =
  | { key: string; kind: 'settings'; settings: TutorSettings }
  | { key: string; kind: 'student-upsert'; student: TutorStudent }
  | { key: string; kind: 'student-delete'; id: string }
  | { key: string; kind: 'lesson-upsert'; lesson: TutorLesson }
  | { key: string; kind: 'lesson-delete'; id: string }
  | { key: string; kind: 'event-upsert'; event: TutorEvent }
  | { key: string; kind: 'event-delete'; id: string }

type TutorDeletedIds = {
  students: Set<string>
  lessons: Set<string>
  events: Set<string>
}

function collectDeletedIds(rows: PendingTutorMutation[]): TutorDeletedIds {
  const deleted: TutorDeletedIds = {
    students: new Set(),
    lessons: new Set(),
    events: new Set(),
  }
  for (const row of rows) {
    if (row.kind === 'student-delete') deleted.students.add(row.id)
    if (row.kind === 'lesson-delete') deleted.lessons.add(row.id)
    if (row.kind === 'event-delete') deleted.events.add(row.id)
  }
  return deleted
}

function withoutDeleted(bundle: Bundle, deleted: TutorDeletedIds): Bundle {
  return {
    ...bundle,
    students: bundle.students.filter((student) => !deleted.students.has(student.id)),
    lessons: bundle.lessons.filter(
      (lesson) =>
        !deleted.lessons.has(lesson.id) && !deleted.students.has(lesson.studentId),
    ),
    events: bundle.events.filter(
      (event) =>
        !deleted.events.has(event.id) &&
        (!event.studentId || !deleted.students.has(event.studentId)),
    ),
  }
}

const empty: Bundle = {
  settings: defaultTutorSettings(),
  students: [],
  lessons: [],
  events: [],
}

function mergeStudents(local: TutorStudent[], remote: TutorStudent[]): TutorStudent[] {
  if (!remote.length) return local.map((s) => hydrateStudent(s))
  const localById = new Map(local.map((s) => [s.id, s]))
  const remoteIds = new Set(remote.map((s) => s.id))
  const merged = remote.map((r) => {
    const l = localById.get(r.id)
    if (!l) return hydrateStudent(r)
    return hydrateStudent({
      ...r,
      ...l,
      slots: l.slots.length ? l.slots : r.slots,
    })
  })
  return [...merged, ...local.filter((s) => !remoteIds.has(s.id)).map((s) => hydrateStudent(s))]
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  if (!remote.length) return local
  const map = new Map(remote.map((e) => [e.id, e]))
  for (const l of local) map.set(l.id, l)
  return [...map.values()]
}

function loadPending(): PendingTutorMutation[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingTutorMutation[]) : []
  } catch {
    return []
  }
}

function savePending(rows: PendingTutorMutation[]) {
  try {
    if (rows.length) localStorage.setItem(PENDING_KEY, JSON.stringify(rows))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    /* основной локальный снимок остаётся */
  }
}

function queuePending(mutation: PendingTutorMutation) {
  savePending([...loadPending().filter((row) => row.key !== mutation.key), mutation])
}

function queuePendingMany(mutations: PendingTutorMutation[]) {
  const map = new Map(loadPending().map((row) => [row.key, row]))
  for (const mutation of mutations) map.set(mutation.key, mutation)
  savePending([...map.values()])
}

function clearPending(key: string) {
  savePending(loadPending().filter((row) => row.key !== key))
}

function saveRollingBackup(bundle: Bundle) {
  if (!bundle.students.length && !bundle.lessons.length && !bundle.events.length) return
  try {
    const raw = localStorage.getItem(BACKUPS_KEY)
    const rows = raw ? (JSON.parse(raw) as TutorBackup[]) : []
    const serialized = JSON.stringify(bundle)
    if (rows.at(-1) && JSON.stringify(rows.at(-1)!.bundle) === serialized) return
    rows.push({ createdAt: new Date().toISOString(), bundle })
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(rows.slice(-5)))
  } catch {
    logSync('Не удалось создать локальную резервную копию учеников')
  }
}

async function executeMutation(userId: string, mutation: PendingTutorMutation) {
  switch (mutation.kind) {
    case 'settings':
      return upsertTutorSettings(userId, mutation.settings)
    case 'student-upsert':
      return upsertStudentRow(userId, mutation.student)
    case 'student-delete':
      return deleteStudentRow(userId, mutation.id)
    case 'lesson-upsert':
      return upsertLessonRow(userId, mutation.lesson)
    case 'lesson-delete':
      return deleteLessonRow(userId, mutation.id)
    case 'event-upsert':
      return upsertEventRow(userId, mutation.event)
    case 'event-delete':
      return deleteEventRow(userId, mutation.id)
  }
}

function mutationLabel(mutation: PendingTutorMutation): string {
  if (mutation.kind === 'settings') return 'настройки учеников'
  if (mutation.kind.startsWith('student')) return 'ученик'
  if (mutation.kind.startsWith('lesson')) return 'занятие'
  return 'событие ученика'
}

function applyPending(bundle: Bundle, rows: PendingTutorMutation[]): Bundle {
  let next = bundle
  for (const row of rows) {
    if (row.kind === 'settings') next = { ...next, settings: row.settings }
    if (row.kind === 'student-upsert') {
      next = {
        ...next,
        students: [
          row.student,
          ...next.students.filter((student) => student.id !== row.student.id),
        ],
      }
    }
    if (row.kind === 'student-delete') {
      next = {
        ...next,
        students: next.students.filter((student) => student.id !== row.id),
        lessons: next.lessons.filter((lesson) => lesson.studentId !== row.id),
        events: next.events.filter((event) => event.studentId !== row.id),
      }
    }
    if (row.kind === 'lesson-upsert') {
      next = {
        ...next,
        lessons: [row.lesson, ...next.lessons.filter((lesson) => lesson.id !== row.lesson.id)],
      }
    }
    if (row.kind === 'lesson-delete') {
      next = { ...next, lessons: next.lessons.filter((lesson) => lesson.id !== row.id) }
    }
    if (row.kind === 'event-upsert') {
      next = {
        ...next,
        events: [row.event, ...next.events.filter((event) => event.id !== row.event.id)],
      }
    }
    if (row.kind === 'event-delete') {
      next = { ...next, events: next.events.filter((event) => event.id !== row.id) }
    }
  }
  return next
}

function hydrateEvent(raw: Partial<TutorEvent>): TutorEvent {
  return {
    id: raw.id ?? '',
    date: raw.date ?? '',
    kind: raw.kind ?? 'payment',
    studentId: raw.studentId ?? null,
    amountRub: raw.amountRub ?? 0,
    title: raw.title ?? '',
    timeHm: raw.timeHm ?? null,
    createdAt: raw.createdAt ?? '',
  }
}

function hydrateBundle(raw: Partial<Bundle>): Bundle {
  return {
    settings: { ...defaultTutorSettings(), ...raw.settings },
    students: (raw.students ?? []).map((student) => hydrateStudent(student)),
    lessons: (raw.lessons ?? []).map((lesson) => hydrateLesson(lesson)),
    events: (raw.events ?? []).map((event) => hydrateEvent(event)),
  }
}

function loadLatestBackup(): Bundle | null {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY)
    if (!raw) return null
    const backup = (JSON.parse(raw) as TutorBackup[]).at(-1)
    return backup ? hydrateBundle(backup.bundle) : null
  } catch {
    return null
  }
}

function loadLocal(): Bundle {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    return hydrateBundle(JSON.parse(raw) as Partial<Bundle>)
  } catch {
    const backup = loadLatestBackup()
    if (backup) {
      logSync('Локальные данные повреждены: восстановлена последняя резервная копия')
      return backup
    }
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
  toggleStudentPaid: (id: string) => Promise<void>
  reorderStudents: (orderedIds: string[]) => Promise<void>
  setLesson: (input: {
    id?: string
    studentId: string
    date: string
    timeHm: string
    status: LessonStatus | null
  }) => Promise<void>
  saveEvent: (input: {
    date: string
    kind: TutorEventKind
    studentId?: string | null
    amountRub?: number
    title?: string
    timeHm?: string | null
    id?: string
  }) => Promise<void>
  removeEvent: (id: string) => Promise<void>
  exportBackup: () => string
  importBackup: (raw: string) => Promise<{ students: number; lessons: number; events: number }>
}

const Ctx = createContext<TutorsStore | null>(null)

export function TutorsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [bundle, setBundle] = useState<Bundle>(empty)
  const [userId, setUserId] = useState<string | null>(null)
  const bundleRef = useRef<Bundle>(empty)
  const flushingRef = useRef(false)
  const deletedIdsRef = useRef<TutorDeletedIds>(collectDeletedIds([]))

  const commit = useCallback((update: Bundle | ((current: Bundle) => Bundle)) => {
    const current = bundleRef.current
    const next = typeof update === 'function' ? update(current) : update
    bundleRef.current = next
    setBundle(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      logSync('Ошибка локального сохранения учеников')
    }
    saveRollingBackup(next)
    return next
  }, [])

  useEffect(() => {
    const local = loadLocal()
    bundleRef.current = local
    setBundle(local)
    saveRollingBackup(local)
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
    const pendingAtStart = loadPending()
    deletedIdsRef.current = collectDeletedIds(pendingAtStart)
    let cancelled = false
    fetchTutorBundle(userId)
      .then((remote) => {
        if (cancelled || !remote) return
        commit((local) =>
          withoutDeleted(applyPending(
            {
              settings: { ...defaultTutorSettings(), ...remote.settings, ...local.settings },
              students: mergeStudents(local.students, remote.students),
              lessons: mergeById(local.lessons.map(hydrateLesson), remote.lessons.map(hydrateLesson)),
              events: mergeById(local.events.map(hydrateEvent), remote.events.map(hydrateEvent)),
            },
            pendingAtStart,
          ), deletedIdsRef.current),
        )
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
    syncLessonReminders(bundle.students, bundle.lessons, on, bundle.events, userId)
    const vis = () => {
      if (document.visibilityState === 'visible') {
        syncLessonReminders(bundle.students, bundle.lessons, on, bundle.events, userId)
      }
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('visibilitychange', vis)
    }
  }, [bundle.settings.enabled, bundle.settings.remindersOn, bundle.students, bundle.lessons, bundle.events, userId])

  const flushPending = useCallback(async () => {
    if (!userId || flushingRef.current) return
    flushingRef.current = true
    try {
      while (true) {
        const mutation = loadPending()[0]
        if (!mutation) break
        await executeMutation(userId, mutation)
        clearPending(mutation.key)
        logSync(`Облако: сохранено — ${mutationLabel(mutation)}`)
      }
    } catch {
      logSync('Облако: ошибка, изменения оставлены в очереди')
    } finally {
      flushingRef.current = false
    }
  }, [userId])

  const cloud = useCallback(
    async (mutation: PendingTutorMutation) => {
      if (!userId) return
      queuePending(mutation)
      logSync(`Локально: ожидает облака — ${mutationLabel(mutation)}`)
      await flushPending()
    },
    [userId, flushPending],
  )

  const cloudMany = useCallback(
    async (mutations: PendingTutorMutation[]) => {
      if (!userId || !mutations.length) return
      queuePendingMany(mutations)
      logSync(`Локально: в очередь облака добавлено ${mutations.length} изменений`)
      await flushPending()
    },
    [userId, flushPending],
  )

  useEffect(() => {
    if (!userId) return
    const retry = () => {
      if (navigator.onLine && document.visibilityState === 'visible') void flushPending()
    }
    void flushPending()
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('focus', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [userId, flushPending])

  const saveSettings = useCallback(
    async (patch: Partial<TutorSettings>) => {
      const settings = { ...bundleRef.current.settings, ...patch }
      commit((current) => ({ ...current, settings }))
      await cloud({ key: 'settings', kind: 'settings', settings })
    },
    [commit, cloud],
  )

  const saveStudent = useCallback(
    async (input: Omit<TutorStudent, 'id' | 'createdAt'> & { id?: string }) => {
      const current = bundleRef.current
      const existing = input.id ? current.students.find((s) => s.id === input.id) : undefined
      const nextOrder =
        existing?.sortOrder ??
        input.sortOrder ??
        current.students.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1
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
        paid:
          existing && existing.packStartedOn !== input.packStartedOn
            ? false
            : input.paid,
        packStartedOn: input.packStartedOn,
        note: input.note,
        sortOrder: nextOrder,
      })
      commit((latest) => ({
        ...latest,
        students: latest.students.some((student) => student.id === row.id)
          ? latest.students.map((student) => (student.id === row.id ? row : student))
          : [...latest.students, row],
      }))
      await cloud({ key: `student-upsert:${row.id}`, kind: 'student-upsert', student: row })
    },
    [commit, cloud],
  )

  const removeStudent = useCallback(
    async (id: string) => {
      deletedIdsRef.current.students.add(id)
      commit((current) => ({
        ...current,
        students: current.students.filter((s) => s.id !== id),
        lessons: current.lessons.filter((l) => l.studentId !== id),
        events: current.events.filter((e) => e.studentId !== id),
      }))
      await cloud({ key: `student-delete:${id}`, kind: 'student-delete', id })
    },
    [commit, cloud],
  )

  const toggleStudentPaid = useCallback(
    async (id: string) => {
      const existing = bundleRef.current.students.find((student) => student.id === id)
      if (!existing) return
      const student = hydrateStudent({ ...existing, paid: !existing.paid })
      commit((current) => ({
        ...current,
        students: current.students.map((row) => (row.id === id ? student : row)),
      }))
      await cloud({ key: `student-upsert:${id}`, kind: 'student-upsert', student })
    },
    [commit, cloud],
  )

  const reorderStudents = useCallback(
    async (orderedIds: string[]) => {
      const current = bundleRef.current
      const byId = new Map(current.students.map((s) => [s.id, s]))
      const seen = new Set(orderedIds)
      const students = [
        ...orderedIds.flatMap((id, i) => {
          const s = byId.get(id)
          return s ? [hydrateStudent({ ...s, sortOrder: i })] : []
        }),
        ...current.students
          .filter((s) => !seen.has(s.id))
          .map((s, i) => hydrateStudent({ ...s, sortOrder: orderedIds.length + i })),
      ]
      commit((latest) => ({ ...latest, students }))
      await cloudMany(
        students.map((student) => ({
          key: `student-upsert:${student.id}`,
          kind: 'student-upsert' as const,
          student,
        })),
      )
    },
    [commit, cloudMany],
  )

  const setLesson = useCallback(
    async (input: {
      id?: string
      studentId: string
      date: string
      timeHm: string
      status: LessonStatus | null
    }) => {
      const current = bundleRef.current
      const prev = input.id
        ? current.lessons.find((l) => l.id === input.id)
        : undefined
      let lessons = current.lessons
      let saved: TutorLesson | undefined
      if (input.status === null && prev) {
        lessons = lessons.filter((l) => l.id !== prev.id)
      } else if (input.status) {
        saved = hydrateLesson({
          id: prev?.id ?? nid(),
          studentId: input.studentId,
          date: input.date,
          timeHm: input.timeHm,
          status: input.status,
          createdAt: prev?.createdAt ?? new Date().toISOString(),
        })
        lessons = [saved, ...lessons.filter((l) => l.id !== saved!.id)]
      }
      let students = current.students
      const student = students.find((s) => s.id === input.studentId)
      let renewedStudent: TutorStudent | undefined
      const size = student ? packSize(student.payKind) : null
      if (
        student &&
        size &&
        input.status &&
        (input.status === 'held' || input.status === 'skipped' || input.status === 'extra')
      ) {
        const used = usedInPack({ ...student }, lessons)
        if (used > size) {
          renewedStudent = hydrateStudent({
            ...student,
            packStartedOn: input.date,
            paid: false,
          })
          students = students.map((s) => (s.id === input.studentId ? renewedStudent! : s))
        }
      }
      commit((latest) => ({ ...latest, students, lessons }))
      if (renewedStudent) {
        await cloud({
          key: `student-upsert:${renewedStudent.id}`,
          kind: 'student-upsert',
          student: renewedStudent,
        })
      }
      if (saved) {
        await cloud({ key: `lesson-upsert:${saved.id}`, kind: 'lesson-upsert', lesson: saved })
      } else if (prev) {
        deletedIdsRef.current.lessons.add(prev.id)
        await cloud({ key: `lesson-delete:${prev.id}`, kind: 'lesson-delete', id: prev.id })
      }
    },
    [commit, cloud],
  )

  const saveEvent = useCallback(
    async (input: {
      date: string
      kind: TutorEventKind
      studentId?: string | null
      amountRub?: number
      title?: string
      timeHm?: string | null
      id?: string
    }) => {
      const current = bundleRef.current
      const prev = input.id
        ? current.events.find((e) => e.id === input.id)
        : input.kind === 'payment' && input.studentId
          ? current.events.find(
              (e) => e.date === input.date && e.studentId === input.studentId && e.kind === input.kind,
            )
          : undefined
      const row = hydrateEvent({
        id: prev?.id ?? nid(),
        date: input.date,
        kind: input.kind,
        studentId: input.studentId ?? prev?.studentId ?? null,
        amountRub: input.amountRub ?? prev?.amountRub ?? 0,
        title: input.title ?? prev?.title ?? '',
        timeHm: input.timeHm !== undefined ? input.timeHm : prev?.timeHm ?? null,
        createdAt: prev?.createdAt ?? new Date().toISOString(),
      })
      commit((latest) => ({
        ...latest,
        events: [row, ...latest.events.filter((event) => event.id !== row.id)],
      }))
      await cloud({ key: `event-upsert:${row.id}`, kind: 'event-upsert', event: row })
    },
    [commit, cloud],
  )

  const removeEvent = useCallback(
    async (id: string) => {
      deletedIdsRef.current.events.add(id)
      commit((current) => ({
        ...current,
        events: current.events.filter((event) => event.id !== id),
      }))
      await cloud({ key: `event-delete:${id}`, kind: 'event-delete', id })
    },
    [commit, cloud],
  )

  const exportBackup = useCallback(
    () =>
      JSON.stringify(
        {
          format: 'forma-tutors-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          data: bundleRef.current,
        },
        null,
        2,
      ),
    [],
  )

  const importBackup = useCallback(
    async (raw: string) => {
      const parsed = JSON.parse(raw) as {
        format?: string
        data?: Partial<Bundle>
      }
      if (parsed.format !== 'forma-tutors-backup' || !parsed.data) {
        throw new Error('Это не резервная копия учеников Форма')
      }
      const imported: Bundle = {
        settings: { ...defaultTutorSettings(), ...parsed.data.settings },
        students: (parsed.data.students ?? []).map((student) => hydrateStudent(student)),
        lessons: (parsed.data.lessons ?? []).map((lesson) => hydrateLesson(lesson)),
        events: (parsed.data.events ?? []).map((event) => hydrateEvent(event)),
      }
      commit((current) => ({
        settings: { ...current.settings, ...imported.settings },
        students: mergeById(imported.students, current.students),
        lessons: mergeById(imported.lessons, current.lessons),
        events: mergeById(imported.events, current.events),
      }))
      logSync(
        `Восстановлена копия: ${imported.students.length} учеников, ${imported.lessons.length} занятий`,
      )
      await cloudMany([
        { key: 'settings', kind: 'settings', settings: imported.settings },
        ...imported.students.map((student) => ({
          key: `student-upsert:${student.id}`,
          kind: 'student-upsert' as const,
          student,
        })),
        ...imported.lessons.map((lesson) => ({
          key: `lesson-upsert:${lesson.id}`,
          kind: 'lesson-upsert' as const,
          lesson,
        })),
        ...imported.events.map((event) => ({
          key: `event-upsert:${event.id}`,
          kind: 'event-upsert' as const,
          event,
        })),
      ])
      return {
        students: imported.students.length,
        lessons: imported.lessons.length,
        events: imported.events.length,
      }
    },
    [commit, cloudMany],
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
      toggleStudentPaid,
      reorderStudents,
      setLesson,
      saveEvent,
      removeEvent,
      exportBackup,
      importBackup,
    }),
    [
      ready,
      open,
      bundle,
      saveSettings,
      saveStudent,
      removeStudent,
      toggleStudentPaid,
      reorderStudents,
      setLesson,
      saveEvent,
      removeEvent,
      exportBackup,
      importBackup,
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
  patch: Partial<Omit<TutorStudent, 'id' | 'createdAt'>> = {},
): Omit<TutorStudent, 'id' | 'createdAt'> => ({
  name: '',
  payKind: 'pack8' as PayKind,
  priceRub: 13000,
  durationMin: 60,
  weekdays: [],
  timeHm: '16:00',
  slots: [{ weekday: 7, timeHm: '16:00' }],
  active: true,
  paid: false,
  packStartedOn: today,
  note: '',
  sortOrder: 0,
  ...patch,
})
