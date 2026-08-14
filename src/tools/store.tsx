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
import type { DraftTask, PlanTask, ToolId, ToolSettings, Transcript } from './types'
import { defaultToolSettings } from './types'
import {
  deleteTaskRow,
  deleteTranscriptRow,
  fetchToolBundle,
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
}

const empty: Bundle = {
  settings: defaultToolSettings(),
  transcripts: [],
  tasks: [],
}

function loadLocal(): Bundle {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Bundle>
    return {
      settings: { ...defaultToolSettings(), ...parsed.settings },
      transcripts: parsed.transcripts ?? [],
      tasks: parsed.tasks ?? [],
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
  saveSettings: (patch: Partial<ToolSettings>) => Promise<void>
  addTranscript: (input: { text: string; durationSec: number }) => Promise<Transcript>
  removeTranscript: (id: string) => Promise<void>
  addTasks: (drafts: DraftTask[], source: PlanTask['source']) => Promise<void>
  addTask: (title: string, dueOn: string | null) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  removeTask: (id: string) => Promise<void>
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
    async (title: string, dueOn: string | null) => {
      await addTasks([{ title, dueOn }], 'manual')
    },
    [addTasks],
  )

  const toggleTask = useCallback(
    async (id: string) => {
      const tasks = bundle.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
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

  const value = useMemo<ToolsStore>(
    () => ({
      ready,
      open,
      setOpen,
      settings: bundle.settings,
      transcripts: bundle.transcripts,
      tasks: bundle.tasks,
      saveSettings,
      addTranscript,
      removeTranscript,
      addTasks,
      addTask,
      toggleTask,
      removeTask,
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
      removeTask,
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
