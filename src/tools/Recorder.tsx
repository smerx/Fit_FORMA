import { useEffect, useRef, useState } from 'react'

function pickMime(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function Recorder({
  onReady,
  disabled,
}: {
  onReady: (blob: Blob, durationSec: number) => void
  disabled?: boolean
}) {
  const [rec, setRec] = useState(false)
  const [paused, setPaused] = useState(false)
  const [sec, setSec] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const started = useRef(0)
  const tick = useRef<number>(0)

  useEffect(() => {
    return () => stopAll()
  }, [])

  function stopAll() {
    window.clearInterval(tick.current)
    recRef.current?.state !== 'inactive' && recRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    recRef.current = null
    streamRef.current = null
  }

  async function start() {
    setErr(null)
    chunks.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' })
        const duration = Math.max(1, Math.round((Date.now() - started.current) / 1000))
        stream.getTracks().forEach((t) => t.stop())
        onReady(blob, duration)
      }
      started.current = Date.now()
      setSec(0)
      recorder.start(1000)
      setRec(true)
      setPaused(false)
      tick.current = window.setInterval(() => {
        const next = Math.round((Date.now() - started.current) / 1000)
        setSec(next)
        if (next >= 900) {
          window.clearInterval(tick.current)
          recRef.current?.stop()
          setRec(false)
          setPaused(false)
        }
      }, 400)
    } catch {
      setErr('Нет доступа к микрофону. Разреши его в Chrome.')
    }
  }

  function pause() {
    if (recRef.current?.state === 'recording') {
      recRef.current.pause()
      setPaused(true)
    } else if (recRef.current?.state === 'paused') {
      recRef.current.resume()
      setPaused(false)
    }
  }

  function stop() {
    window.clearInterval(tick.current)
    recRef.current?.stop()
    setRec(false)
    setPaused(false)
  }

  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')

  return (
    <div className="rounded-3xl bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-white/40">{rec ? (paused ? 'Пауза' : 'Идёт запись') : 'Голос'}</div>
          <div className="font-mono text-3xl font-extrabold tabular-nums">
            {mm}:{ss}
          </div>
          <div className="text-[11px] text-white/35">До 15 минут. Русский, можно говорить свободно.</div>
        </div>
        <div
          className={`h-14 w-14 rounded-full ${rec && !paused ? 'animate-pulse bg-carbs' : 'bg-white/10'}`}
        />
      </div>
      <div className="mt-4 flex gap-2">
        {!rec ? (
          <button
            disabled={disabled}
            onClick={() => void start()}
            className="h-12 flex-1 rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
          >
            Говорить
          </button>
        ) : (
          <>
            <button onClick={pause} className="h-12 flex-1 rounded-2xl bg-white/8 font-semibold">
              {paused ? 'Дальше' : 'Пауза'}
            </button>
            <button onClick={stop} className="h-12 flex-1 rounded-2xl bg-mint font-bold text-bg">
              Стоп
            </button>
          </>
        )}
      </div>
      {sec >= 900 && rec && (
        <p className="mt-2 text-xs text-carbs">Лимит 15 минут — лучше остановить и расшифровать.</p>
      )}
      {err && <p className="mt-2 text-sm text-carbs">{err}</p>}
    </div>
  )
}
