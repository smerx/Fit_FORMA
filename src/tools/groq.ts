export async function transcribeAudio(file: Blob, groqKey: string): Promise<string> {
  const fd = new FormData()
  const ext = file.type.includes('mp4') ? 'mp4' : 'webm'
  fd.append('file', file, `speech.${ext}`)
  fd.append('model', 'whisper-large-v3-turbo')
  fd.append('language', 'ru')
  fd.append('response_format', 'text')
  fd.append(
    'prompt',
    'Это устная русская речь: дела, планы на день, имена, бытовые задачи.',
  )
  const res = await fetch('/api/stt', {
    method: 'POST',
    headers: { 'X-Groq-Key': groqKey },
    body: fd,
  })
  const text = (await res.text()).trim()
  if (!res.ok) throw new Error(text || 'Не удалось расшифровать')
  return text
}

export async function transcriptToPlan(
  transcript: string,
  groqKey: string,
  today: string,
): Promise<{ title: string; tasks: { title: string; notes: string; dueOn: string | null }[] }> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Groq-Key': groqKey,
    },
    body: JSON.stringify({ transcript, today }),
  })
  const data = (await res.json()) as {
    error?: string
    title?: string
    tasks?: { title: string; notes?: string; dueOn?: string | null }[]
  }
  if (!res.ok) throw new Error(data.error || 'Не удалось собрать план')
  return {
    title: data.title || 'План',
    tasks: (data.tasks ?? [])
      .map((t) => ({
        title: (t.title || '').trim(),
        notes: (t.notes || '').trim(),
        dueOn: t.dueOn || null,
      }))
      .filter((t) => t.title),
  }
}
