export type ToolId = 'transcript' | 'voiceplan' | 'planner'

export type ToolSettings = {
  groqKey: string
  transcriptOn: boolean
  voicePlanOn: boolean
  plannerOn: boolean
}

export type Transcript = {
  id: string
  title: string
  text: string
  durationSec: number
  createdAt: string
}

export type PlanTask = {
  id: string
  title: string
  notes: string
  dueOn: string | null
  done: boolean
  source: 'manual' | 'voice' | 'suggest'
  createdAt: string
}

export type DraftTask = {
  title: string
  notes?: string
  dueOn?: string | null
}

export const defaultToolSettings = (): ToolSettings => ({
  groqKey: '',
  transcriptOn: true,
  voicePlanOn: true,
  plannerOn: true,
})
