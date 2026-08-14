import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { lookupBarcode } from '../lib/off'
import { Sheet } from './ui'

export function BarcodeSheet() {
  const { overlay, setOverlay } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const lockedRef = useRef(false)
  const [manual, setManual] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const meal = overlay.type === 'barcode' ? overlay.meal : 'lunch'

  useEffect(() => {
    if (overlay.type !== 'barcode') return
    const video = videoRef.current
    if (!video) return
    const node = video
    let stop = false
    let stream: MediaStream | null = null
    let raf = 0
    lockedRef.current = false

    async function resolveCode(code: string) {
      if (lockedRef.current || stop) return
      lockedRef.current = true
      setBusy(true)
      const food = await lookupBarcode(code)
      if (stop) return
      if (!food) {
        setError('Пачка не найдена. Можно ввести код вручную или добавить как свой продукт.')
        setBusy(false)
        lockedRef.current = false
        return
      }
      setOverlay({ type: 'grams', food, meal })
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (stop) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        node.srcObject = stream
        await node.play()
        const Detector = window.BarcodeDetector
        if (!Detector) {
          setError('Камера есть, но сканер штрихкода в этом браузере недоступен. Введи цифры с пачки.')
          return
        }
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
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
      stream?.getTracks().forEach((t) => t.stop())
      if (node.srcObject) node.srcObject = null
    }
  }, [overlay.type, meal, setOverlay])

  if (overlay.type !== 'barcode') return null

  return (
    <Sheet title="Штрихкод" onClose={() => setOverlay({ type: 'search', meal })}>
      <div className="overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} className="h-52 w-full object-cover" playsInline muted autoPlay />
      </div>
      <p className="mt-3 text-sm text-white/45">Наведи камеру на штрихкод. Ищем пачку в Open Food Facts.</p>
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
            setError('Не нашёл. Попробуй свой продукт.')
            setBusy(false)
            return
          }
          setOverlay({ type: 'grams', food, meal })
        }}
        className="mt-3 h-12 w-full rounded-2xl bg-mint font-bold text-bg disabled:opacity-40"
      >
        Найти по коду
      </button>
    </Sheet>
  )
}
