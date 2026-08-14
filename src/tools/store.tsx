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
import type { DraftTask, PlanNote, PlanTask, ToolId, ToolSettings, Transcript } from './types'
import { defaultToolSettings } from './types'
import {
  deleteNoteRow,
  deleteTaskRow,
  deleteTranscriptRow,
  fetchToolBundle,
  insertNote,
  insertTask,
  insertTranscript,
  updateTaskRow,
  upsertToolSettings,
} from './cloud'

const KEY = 'forma-tools-v1'

type Bundle = {
  settings: ToolSettings
  transcripts: Transcript[]
  tasks: PlanTask[]
  notes: PlanNote[]
}

const empty: Bundle = {
  settings: defaultToolSettings(),
  transcripts: [],
  tasks: [],
  notes: [],
}

function loadLocal(): Bundle {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Bundle>
    return {
      settings: { ...defaultToolSettings(), ...parsed.settings },
      transcripts: parsed.transcripts ?? [],
      tasks: (parsed.tasks ?? []).map((t) => ({ ...t, dueTime: t.dueTime ?? null })),
      notes: parsed.notes ?? [],
    }
  } catch {
    return empty
  }
}

type ToolsStore = {
  ready: boolean
  open: ToolId | null
  setOpen: (id: ToolId | null) => void
  settings: ToolSettings
  transcripts: Transcript[]
  tasks: PlanTask[]
  notes: PlanNote[]
  saveSettings: (patch: Partial<ToolSettings>) => Promise<void>
  addTranscript: (input: { text: string; durationSec: number }) => Promise<Transcript>
  removeTranscript: (id: string) => Promise<void>
  addTasks: (drafts: DraftTask[], source: PlanTask['source']) => Promise<void>
  addTask: (title: string, dueOn: string | null, dueTime?: string | null) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  patchTask: (id: string, patch: Partial<Pick<PlanTask, 'dueOn' | 'dueTime' | 'title' | 'done'>>) => Promise<void>
  removeTask: (id: string) => Promise<void>
  addNote: (body: string) => Promise<void>
  removeNote: (id: string) => Promise<void>
}

const Ctx = createContext<ToolsStore | null>(null)

export function ToolsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState<ToolId | null>(null)
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
    fetchToolBundle(userId)
      .then((remote) => {
        if (cancelled || !remote) return
        const local = loadLocal()
        commit({
          settings: remote.settings.groqKey || local.settings.groqKey
            ? { ...local.settings, ...remote.settings, groqKey: remote.settings.groqKey || local.settings.groqKey }
            : { ...defaultToolSettings(), ...remote.settings, groqKey: local.settings.groqKey },
          transcripts: remote.transcripts.length ? remote.transcripts : local.transcripts,
          tasks: remote.tasks.length ? remote.tasks : local.tasks,
          notes: remote.notes.length ? remote.notes : local.notes,
        })
      })
      .catch(() => {
        /* инструменты молча остаются локальными */
      })
    return () => {
      cancelled = true
    }
  }, [userId, commit])

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
    async (patch: Partial<ToolSettings>) => {
      const settings = { ...bundle.settings, ...patch }
      commit({ ...bundle, settings })
      await cloud(async () => {
        if (!userId) return
        await upsertToolSettings(userId, settings)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const addTranscript = useCallback(
    async (input: { text: string; durationSec: number }) => {
      const first = input.text.trim().split('\n')[0]?.slice(0, 48) || 'Расшифровка'
      const row: Transcript = {
        id: nid(),
        title: first,
        text: input.text.trim(),
        durationSec: input.durationSec,
        createdAt: new Date().toISOString(),
      }
      commit({ ...bundle, transcripts: [row, ...bundle.transcripts] })
      await cloud(async () => {
        if (!userId) return
        await insertTranscript(userId, row)
      })
      return row
    },
    [bundle, commit, cloud, userId],
  )

  const removeTranscript = useCallback(
    async (id: string) => {
      commit({ ...bundle, transcripts: bundle.transcripts.filter((t) => t.id !== id) })
      await cloud(async () => {
        if (!userId) return
        await deleteTranscriptRow(userId, id)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const addTasks = useCallback(
    async (drafts: DraftTask[], source: PlanTask['source']) => {
      const rows: PlanTask[] = drafts
        .filter((d) => d.title.trim())
        .map((d) => ({
          id: nid(),
          title: d.title.trim(),
          notes: d.notes ?? '',
          dueOn: d.dueOn ?? null,
          dueTime: d.dueTime ?? null,
          done: false,
          source,
          createdAt: new Date().toISOString(),
        }))
      if (!rows.length) return
      commit({ ...bundle, tasks: [...rows, ...bundle.tasks] })
      await cloud(async () => {
        if (!userId) return
        for (const row of rows) await insertTask(userId, row)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const addTask = useCallback(
    async (title: string, dueOn: string | null, dueTime?: string | null) => {
      await addTasks([{ title, dueOn, dueTime: dueTime ?? null }], 'manual')
    },
    [addTasks],
  )

  const patchTask = useCallback(
    async (id: string, patch: Partial<Pick<PlanTask, 'dueOn' | 'dueTime' | 'title' | 'done'>>) => {
      const tasks = bundle.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))
      const row = tasks.find((t) => t.id === id)
      commit({ ...bundle, tasks })
      if (!row) return
      await cloud(async () => {
        if (!userId) return
        await updateTaskRow(userId, row)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const toggleTask = useCallback(
    async (id: string) => {
      const row = bundle.tasks.find((t) => t.id === id)
      if (!row) return
      await patchTask(id, { done: !row.done })
    },
    [bundle.tasks, patchTask],
  )

  const removeTask = useCallback(
    async (id: string) => {
      commit({ ...bundle, tasks: bundle.tasks.filter((t) => t.id !== id) })
      await cloud(async () => {
        if (!userId) return
        await deleteTaskRow(userId, id)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const addNote = useCallback(
    async (body: string) => {
      const text = body.trim()
      if (!text) return
      const row: PlanNote = { id: nid(), body: text, createdAt: new Date().toISOString() }
      commit({ ...bundle, notes: [row, ...bundle.notes] })
      await cloud(async () => {
        if (!userId) return
        await insertNote(userId, row)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const removeNote = useCallback(
    async (id: string) => {
      commit({ ...bundle, notes: bundle.notes.filter((n) => n.id !== id) })
      await cloud(async () => {
        if (!userId) return
        await deleteNoteRow(userId, id)
      })
    },
    [bundle, commit, cloud, userId],
  )

  const value = useMemo<ToolsStore>(
    () => ({
      ready,
      open,
      setOpen,
      settings: bundle.settings,
      transcripts: bundle.transcripts,
      tasks: bundle.tasks,
      notes: bundle.notes,
      saveSettings,
      addTranscript,
      removeTranscript,
      addTasks,
      addTask,
      toggleTask,
      patchTask,
      removeTask,
      addNote,
      removeNote,
    }),
    [
      ready,
      open,
      bundle,
      saveSettings,
      addTranscript,
      removeTranscript,
      addTasks,
      addTask,
      toggleTask,
      patchTask,
      removeTask,
      addNote,
      removeNote,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTools(): ToolsStore {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Tools store missing')
  return ctx
}

export function useToolsOptional(): ToolsStore | null {
  return useContext(Ctx)
}
