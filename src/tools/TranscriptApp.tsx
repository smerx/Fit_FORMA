import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Recorder } from './Recorder'
import { transcribeAudio } from './groq'
import { useTools } from './store'

export function TranscriptApp() {
  const { settings, transcripts, addTranscript, removeTranscript } = useTools()
  const [text, setText] = useState('')
  const [lastDur, setLastDur] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  async function fromBlob(blob: Blob, durationSec: number) {
    if (!settings.groqKey) {
      setErr('Сначала вставь Groq-ключ в настройках.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const out = await transcribeAudio(blob, settings.groqKey)
      setText(out)
      setLastDur(durationSec)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка расшифровки')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-white/50">
        Говори хоть десять минут. Получится сплошной текст, без плана. Можно поправить руками и сохранить.
      </p>
      <Recorder disabled={busy || !settings.groqKey} onReady={(blob, sec) => void fromBlob(blob, sec)} />
      {!settings.groqKey && (
        <p className="text-sm text-amber-200/80">Нужен бесплатный ключ Groq — он в настройках профиля, блок «Инструменты».</p>
      )}
      {busy && <p className="text-sm text-mint">Слушаю запись, это может занять минуту...</p>}
      {err && <p className="text-sm text-carbs">{err}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Здесь появится расшифровка..."
        className="min-h-40 w-full rounded-3xl bg-white/5 p-4 text-sm leading-relaxed outline-none"
      />
      <button
        disabled={!text.trim()}
        onClick={async () => {
          await addTranscript({ text, durationSec: lastDur })
          setText('')
          setLastDur(0)
        }}
        className="h-12 w-full rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
      >
        Сохранить расшифровку
      </button>
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">История</h2>
        {transcripts.length === 0 && <p className="text-sm text-white/35">Пока пусто</p>}
        {transcripts.map((t) => (
          <div key={t.id} className="rounded-3xl bg-card p-3">
            <button onClick={() => setOpenId(openId === t.id ? null : t.id)} className="w-full text-left">
              <div className="font-semibold">{t.title}</div>
              <div className="text-xs text-white/40">{new Date(t.createdAt).toLocaleString('ru')}</div>
            </button>
            {openId === t.id && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{t.text}</p>
            )}
            <button
              onClick={() => removeTranscript(t.id)}
              className="mt-2 flex h-10 items-center gap-1 text-xs text-white/35"
            >
              <Trash2 size={14} /> удалить
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
