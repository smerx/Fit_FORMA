import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '../lib/store'
import { bmi, weeksToGoal } from '../lib/nutrition'
import { formatLongDate } from '../lib/dates'
import { weekReport } from '../lib/weekly'
import { Sheet } from '../components/ui'
import { ToolsBoundary } from '../tools/error-boundary'
import { ToolsDock } from '../tools/ToolsDock'

export function ProgressScreen() {
  const { snapshot, setOverlay, removeWeight, date } = useStore()
  const profile = snapshot.profile
  const logs = useMemo(
    () => [...snapshot.weightLogs].sort((a, b) => a.date.localeCompare(b.date)),
    [snapshot.weightLogs],
  )
  const data = useMemo(
    () =>
      logs.map((l) => ({
        date: l.date.slice(5),
        kg: l.weight,
      })),
    [logs],
  )
  if (!profile) return null

  const last = logs.at(-1)?.weight ?? profile.weightKg
  const first = logs[0]?.weight ?? profile.weightKg
  const delta7 = deltaSince(logs, 7, last)
  const delta30 = deltaSince(logs, 30, last)
  const weeks = weeksToGoal({ ...profile, weightKg: last })
  const week = weekReport(
    profile,
    date,
    snapshot.foodEntries,
    snapshot.activityEntries,
    snapshot.weightLogs,
    snapshot.waterEntries,
  )

  return (
    <div className="space-y-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Прогресс</h1>
        <button
          onClick={() => setOverlay({ type: 'weight' })}
          className="h-11 rounded-full bg-mint px-4 font-bold text-bg"
        >
          Вес
        </button>
      </header>

      <section className="grid grid-cols-2 gap-2">
        <Stat label="Сейчас" value={`${last.toFixed(1)} кг`} />
        <Stat label="Цель" value={`${profile.goalWeightKg} кг`} />
        <Stat label="ИМТ" value={`${bmi(last, profile.heightCm)}`} />
        <Stat
          label="До цели"
          value={weeks == null ? '—' : weeks === 0 ? 'уже там' : `~${weeks} нед.`}
        />
      </section>

      <section className="rounded-3xl bg-card p-4">
        <h2 className="font-bold">Неделя</h2>
        <p className="mt-1 text-xs text-white/40">
          {week.loggedDays ? `По ${week.loggedDays} дням с едой в дневнике` : 'Пока мало записей — появится само'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Mini k="Средний дефицит" v={week.loggedDays ? `${week.avgDeficit} ккал` : '—'} />
          <Mini
            k="Белок / день"
            v={week.loggedDays ? `${week.avgProtein} / ${week.proteinNeed} г` : '—'}
          />
          <Mini
            k="Вес за 7 дней"
            v={
              week.weightDelta == null
                ? 'мало взвешиваний'
                : `${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг`
            }
          />
          <Mini k="Вода / день" v={week.loggedDays ? `${week.avgWater} мл` : '—'} />
        </div>
      </section>

      <section className="rounded-3xl bg-card p-4">
        <div className="mb-3 flex gap-3 text-sm">
          <Trend label="7 дней" value={delta7} />
          <Trend label="30 дней" value={delta30} />
          <Trend label="Всего" value={last - first} />
        </div>
        <div className="h-52">
          {data.length < 2 ? (
            <div className="flex h-full items-center justify-center text-sm text-white/35">
              Запиши вес пару раз — появится график
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="kg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3ddc97" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3ddc97" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" stroke="#667" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#667"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 1', 'dataMax + 1']}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ background: '#181b24', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                  labelStyle={{ color: '#aaa' }}
                  formatter={(v) => [`${v} кг`, 'Вес']}
                />
                <Area type="monotone" dataKey="kg" stroke="#3ddc97" fill="url(#kg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white/50">История взвешиваний</h2>
        {logs
          .slice()
          .reverse()
          .slice(0, 12)
          .map((l) => (
            <button
              key={l.id}
              onClick={() => removeWeight(l.id)}
              className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left"
            >
              <span className="text-sm text-white/50">{formatLongDate(l.date)}</span>
              <span className="font-semibold">{l.weight.toFixed(1)} кг</span>
            </button>
          ))}
      </section>

      <ToolsBoundary name="dock">
        <ToolsDock />
      </ToolsBoundary>
    </div>
  )
}

export function WeightSheet() {
  const { overlay, setOverlay, snapshot, addWeightLog, date } = useStore()
  const current = snapshot.profile?.weightKg ?? 80
  const [weight, setWeight] = useState(current)

  useEffect(() => {
    if (overlay.type === 'weight') setWeight(snapshot.profile?.weightKg ?? 80)
  }, [overlay.type, snapshot.profile?.weightKg])

  if (overlay.type !== 'weight') return null

  return (
    <Sheet title="Записать вес" onClose={() => setOverlay({ type: 'none' })}>
      <div className="flex items-end gap-2">
        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value) || 0)}
          className="w-36 bg-transparent text-5xl font-extrabold outline-none"
        />
        <span className="pb-2 text-white/40">кг</span>
      </div>
      <input
        type="range"
        min={50}
        max={160}
        step={0.1}
        value={weight}
        onChange={(e) => setWeight(Number(e.target.value))}
        className="mt-4 w-full"
      />
      <button
        onClick={() => addWeightLog(Number(weight.toFixed(1)), date)}
        className="mt-6 h-14 w-full rounded-2xl bg-mint font-bold text-bg"
      >
        Сохранить
      </button>
    </Sheet>
  )
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-2">
      <div className="text-[11px] text-white/40">{k}</div>
      <div className="font-bold">{v}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="text-xs text-white/40">{label}</div>
      <div className="text-xl font-extrabold">{value}</div>
    </div>
  )
}

function Trend({ label, value }: { label: string; value: number }) {
  const sign = value > 0 ? '+' : ''
  const color = value < 0 ? 'text-mint' : value > 0 ? 'text-carbs' : 'text-white/60'
  return (
    <div className="flex-1">
      <div className="text-[11px] text-white/40">{label}</div>
      <div className={`font-bold ${color}`}>
        {sign}
        {value.toFixed(1)} кг
      </div>
    </div>
  )
}

function deltaSince(
  logs: { date: string; weight: number }[],
  days: number,
  last: number,
): number {
  if (!logs.length) return 0
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const iso = cutoff.toISOString().slice(0, 10)
  const prev = [...logs].reverse().find((l) => l.date <= iso) ?? logs[0]
  return last - prev.weight
}
