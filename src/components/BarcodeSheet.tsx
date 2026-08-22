import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { extractBarcodePayload, lookupBarcode } from '../lib/off'
import { Sheet } from './ui'

type Caps = {
  focusMode?: string[]
  zoom?: { min: number; max: number; step?: number }
}

async function tuneCamera(track: MediaStreamTrack) {
  const caps = (track.getCapabilities?.() ?? {}) as Caps
  const advanced: MediaTrackConstraintSet[] = []

  if (caps.focusMode?.includes('continuous')) {
    advanced.push({ focusMode: 'continuous' } as MediaTrackConstraintSet)
  } else if (caps.focusMode?.includes('single-shot')) {
    advanced.push({ focusMode: 'single-shot' } as MediaTrackConstraintSet)
  }

  // Лёгкий зум часто заставляет AF поймать штрихкод на телефоне
  if (caps.zoom) {
    const { min, max } = caps.zoom
    const target = Math.min(max, Math.max(min, min + (max - min) * 0.2))
    if (Number.isFinite(target) && target > min) {
      advanced.push({ zoom: target } as MediaTrackConstraintSet)
    }
  }

  try {
    if (advanced.length) await track.applyConstraints({ advanced })
  } catch {
    /* устройство не умеет */
  }

  try {
    await track.applyConstraints({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    })
  } catch {
    /* ignore */
  }
}

async function pulseFocus(track: MediaStreamTrack) {
  const caps = (track.getCapabilities?.() ?? {}) as Caps
  try {
    if (caps.focusMode?.includes('single-shot')) {
      await track.applyConstraints({
        advanced: [{ focusMode: 'single-shot' } as MediaTrackConstraintSet],
      })
      return
    }
    if (caps.focusMode?.includes('continuous')) {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
      })
      return
    }
  } catch {
    /* ignore */
  }
  // ImageCapture иногда дергает AF, даже если focusMode нет в capabilities
  try {
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } })
      .ImageCapture
    if (IC) {
      const shot = new IC(track)
      await shot.takePhoto().catch(() => null)
    }
  } catch {
    /* ignore */
  }
}

const DETECT_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'qr_code',
  'data_matrix',
  'itf',
] as const

export function BarcodeSheet() {
  const { overlay, setOverlay } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const lockedRef = useRef(false)
  const [manual, setManual] = useState('')
  const [lastCode, setLastCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('Наведи на штрихкод, тапни по кадру для фокуса')
  const meal = overlay.type === 'barcode' ? overlay.meal : 'lunch'

  useEffect(() => {
    if (overlay.type !== 'barcode') return
    const video = videoRef.current
    if (!video) return
    const node = video
    let stop = false
    let stream: MediaStream | null = null
    let raf = 0
    let focusTimer = 0
    lockedRef.current = false
    setError(null)
    setBusy(false)
    setLastCode('')

    async function resolveCode(raw: string) {
      if (lockedRef.current || stop) return
      lockedRef.current = true
      setBusy(true)
      setError(null)
      const payload = extractBarcodePayload(raw)
      setLastCode(payload.replace(/\D/g, '') || payload)
      setManual(payload.replace(/\D/g, '') || payload)
      const food = await lookupBarcode(payload)
      if (stop) return
      if (!food) {
        setError('Пачки нет в базе. Добавь как свой продукт — код запомнится на этом телефоне.')
        setBusy(false)
        lockedRef.current = false
        return
      }
      setOverlay({ type: 'grams', food, meal })
    }

    async function start() {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          })
        }
        if (stop) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const track = stream.getVideoTracks()[0] ?? null
        trackRef.current = track
        if (track) {
          await tuneCamera(track)
          await pulseFocus(track)
          focusTimer = window.setInterval(() => {
            if (trackRef.current && !lockedRef.current) void pulseFocus(trackRef.current)
          }, 1800)
        }
        node.srcObject = stream
        await node.play()
        setHint('Тапни по кадру — перефокус · зум чуть подкручен')

        const Detector = window.BarcodeDetector
        if (!Detector) {
          setError('Камера есть, но сканер в этом браузере недоступен. Введи цифры с пачки.')
          return
        }

        let formats = [...DETECT_FORMATS] as string[]
        try {
          const supported = await Detector.getSupportedFormats?.()
          if (supported?.length) {
            formats = formats.filter((f) => supported.includes(f))
            if (!formats.length) formats = supported
          }
        } catch {
          /* старый API */
        }

        const detector = new Detector({ formats })
        const tick = async () => {
          if (stop || !videoRef.current || lockedRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            const value = codes[0]?.rawValue
            if (value) {
              await resolveCode(value)
              return
            }
          } catch {
            /* кадр ещё не готов */
          }
          raf = requestAnimationFrame(() => {
            void tick()
          })
        }
        void tick()
      } catch {
        setError('Нет доступа к камере. Разреши её в Chrome или введи код с пачки.')
      }
    }

    void start()
    return () => {
      stop = true
      cancelAnimationFrame(raf)
      window.clearInterval(focusTimer)
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
      if (node.srcObject) node.srcObject = null
    }
  }, [overlay.type, meal, setOverlay])

  async function tapFocus() {
    const track = trackRef.current
    if (!track) return
    setHint('Фокусирую…')
    await pulseFocus(track)
    setHint('Держи штрихкод ровнее и ближе к рамке')
  }

  if (overlay.type !== 'barcode') return null

  const codeForCustom = (manual.replace(/\D/g, '') || lastCode.replace(/\D/g, '')).slice(0, 14)

  return (
    <Sheet title="Штрихкод" onClose={() => setOverlay({ type: 'search', meal })}>
      <button type="button" onClick={() => void tapFocus()} className="relative block w-full overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted autoPlay />
        <span className="pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-xl border border-mint/50" />
      </button>
      <p className="mt-2 text-center text-[11px] text-white/35">{hint}</p>
      <p className="mt-2 text-sm text-white/45">
        Open Food Facts (RU + мир) и локальные коды. Нет в базе — один раз добавь «Свой продукт», дальше подтянется.
      </p>
      {error && <p className="mt-2 text-sm text-carbs">{error}</p>}
      {busy && <p className="mt-2 text-sm text-mint">Ищу продукт...</p>}
      <label className="mt-4 block">
        <span className="mb-1 block text-xs text-white/45">Или цифры с пачки</span>
        <input
          inputMode="numeric"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="4600..."
          className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
        />
      </label>
      <button
        disabled={manual.replace(/\D/g, '').length < 8 || busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          const food = await lookupBarcode(manual)
          if (!food) {
            setLastCode(manual.replace(/\D/g, ''))
            setError('Не нашёл. Добавь как свой продукт — в следующий раз подтянется с телефона.')
            setBusy(false)
            return
          }
          setOverlay({ type: 'grams', food, meal })
        }}
        className="mt-3 h-12 w-full rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
      >
        Найти по коду
      </button>
      {(error || codeForCustom.length >= 8) && (
        <button
          onClick={() =>
            setOverlay({
              type: 'custom-food',
              meal,
              barcode: codeForCustom || undefined,
              draftName: '',
            })
          }
          className="mt-2 h-11 w-full rounded-2xl bg-white/8 text-sm font-semibold"
        >
          Свой продукт{codeForCustom ? ` · ${codeForCustom}` : ''}
        </button>
      )}
    </Sheet>
  )
}
