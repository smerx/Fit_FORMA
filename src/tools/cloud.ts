import { supabase } from '../lib/supabase'
import type { PlanTask, ToolSettings, Transcript } from './types'
import { defaultToolSettings } from './types'

type SettingsRow = {
  groq_key: string | null
  transcript_on: boolean
  voice_plan_on: boolean
  planner_on: boolean
}

type TranscriptRow = {
  id: string
  title: string
  body: string
  duration_sec: number
  created_at: string
}

type TaskRow = {
  id: string
  title: string
  notes: string | null
  due_on: string | null
  done: boolean
  source: PlanTask['source']
  created_at: string
}

export async function fetchToolBundle(userId: string): Promise<{
  settings: ToolSettings
  transcripts: Transcript[]
  tasks: PlanTask[]
} | null> {
  if (!supabase) return null
  const [setRes, trRes, taskRes] = await Promise.all([
    supabase.from('tool_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('tool_transcripts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('tool_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  if (setRes.error && trRes.error && taskRes.error) return null
  const row = setRes.data as SettingsRow | null
  return {
    settings: row
      ? {
          groqKey: row.groq_key ?? '',
          transcriptOn: row.transcript_on,
          voicePlanOn: row.voice_plan_on,
          plannerOn: row.planner_on,
        }
      : defaultToolSettings(),
    transcripts: trRes.error
      ? []
      : ((trRes.data ?? []) as TranscriptRow[]).map((r) => ({
          id: r.id,
          title: r.title,
          text: r.body,
          durationSec: r.duration_sec,
          createdAt: r.created_at,
        })),
    tasks: taskRes.error
      ? []
      : ((taskRes.data ?? []) as TaskRow[]).map((r) => ({
          id: r.id,
          title: r.title,
          notes: r.notes ?? '',
          dueOn: r.due_on,
          done: r.done,
          source: r.source,
          createdAt: r.created_at,
        })),
  }
}

export async function upsertToolSettings(userId: string, s: ToolSettings) {
  if (!supabase) return
  const { error } = await supabase.from('tool_settings').upsert({
    user_id: userId,
    groq_key: s.groqKey,
    transcript_on: s.transcriptOn,
    voice_plan_on: s.voicePlanOn,
    planner_on: s.plannerOn,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function insertTranscript(userId: string, t: Transcript) {
  if (!supabase) return
  const { error } = await supabase.from('tool_transcripts').insert({
    id: t.id,
    user_id: userId,
    title: t.title,
    body: t.text,
    duration_sec: t.durationSec,
    created_at: t.createdAt,
  })
  if (error) throw error
}

export async function deleteTranscriptRow(userId: string, id: string) {
  if (!supabase) return
  const { error } = await supabase.from('tool_transcripts').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function insertTask(userId: string, t: PlanTask) {
  if (!supabase) return
  const { error } = await supabase.from('tool_tasks').insert({
    id: t.id,
    user_id: userId,
    title: t.title,
    notes: t.notes,
    due_on: t.dueOn,
    done: t.done,
    source: t.source,
    created_at: t.createdAt,
  })
  if (error) throw error
}

export async function updateTaskRow(userId: string, t: PlanTask) {
  if (!supabase) return
  const { error } = await supabase
    .from('tool_tasks')
    .update({ title: t.title, notes: t.notes, due_on: t.dueOn, done: t.done })
    .eq('id', t.id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteTaskRow(userId: string, id: string) {
  if (!supabase) return
  const { error } = await supabase.from('tool_tasks').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}
