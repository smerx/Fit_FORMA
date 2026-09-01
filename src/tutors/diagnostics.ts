const SYNC_LOG_KEY = 'forma-tutors-sync-log-v1'

export type TutorSyncLog = {
  at: string
  message: string
}

export function readTutorSyncLog(): TutorSyncLog[] {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY)
    return raw ? (JSON.parse(raw) as TutorSyncLog[]) : []
  } catch {
    return []
  }
}

export function appendTutorSyncLog(message: string) {
  try {
    const rows = [...readTutorSyncLog(), { at: new Date().toISOString(), message }].slice(-40)
    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(rows))
  } catch {
    /* диагностический журнал необязателен */
  }
}
