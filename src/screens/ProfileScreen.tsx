import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { bmr, dailyCalorieTarget, withProfileDefaults } from '../lib/nutrition'
import { Sheet } from '../components/ui'
import type { Profile, Sex } from '../types'

export function ProfileSheet() {
  const { overlay, setOverlay, snapshot, updateProfile, signOut, supabaseEnabled } = useStore()
  const profile = snapshot.profile
  const [draft, setDraft] = useState<Profile | null>(profile)

  useEffect(() => {
    if (overlay.type === 'profile' && snapshot.profile) setDraft(withProfileDefaults(snapshot.profile))
  }, [overlay.type, snapshot.profile])

  if (overlay.type !== 'profile' || !profile || !draft) return null
  const auto = dailyCalorieTarget({ ...draft, calorieGoal: null })

  return (
    <Sheet title="Профиль" onClose={() => setOverlay({ type: 'none' })}>
      <div className="space-y-3">
        <Field label="Имя" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <div className="grid grid-cols-2 gap-2">
          <SexToggle value={draft.sex} onChange={(sex) => setDraft({ ...draft, sex })} />
          <Num label="Возраст" value={draft.age} onChange={(age) => setDraft({ ...draft, age })} />
          <Num label="Рост, см" value={draft.heightCm} onChange={(heightCm) => setDraft({ ...draft, heightCm })} />
          <Num label="Вес, кг" value={draft.weightKg} step={0.1} onChange={(weightKg) => setDraft({ ...draft, weightKg })} />
          <Num
            label="Цель, кг"
            value={draft.goalWeightKg}
            step={0.1}
            onChange={(goalWeightKg) => setDraft({ ...draft, goalWeightKg })}
          />
          <Num label="Дефицит" value={draft.deficit} onChange={(deficit) => setDraft({ ...draft, deficit })} />
        </div>
        <p className="text-xs text-white/40">
          Базовый обмен {bmr(draft)} ккал. Автоцель {auto} ккал (сидячий день минус дефицит).
        </p>
        <label className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-3">
          <span className="text-sm">Своя цель ккал</span>
          <input
            type="checkbox"
            checked={draft.calorieGoal != null}
            onChange={(e) =>
              setDraft({ ...draft, calorieGoal: e.target.checked ? auto : null })
            }
          />
        </label>
        {draft.calorieGoal != null && (
          <Num
            label="Ккал в день"
            value={draft.calorieGoal}
            onChange={(calorieGoal) => setDraft({ ...draft, calorieGoal })}
          />
        )}
        <Num
          label="Цель по воде, мл"
          value={draft.waterGoalMl}
          onChange={(waterGoalMl) => setDraft({ ...draft, waterGoalMl })}
        />
        <label className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-3">
          <span className="text-sm">Советы и факты</span>
          <input
            type="checkbox"
            checked={draft.tipsEnabled}
            onChange={(e) => setDraft({ ...draft, tipsEnabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-3">
          <span className="text-sm">Отмечать витамины</span>
          <input
            type="checkbox"
            checked={draft.tracksVitamins}
            onChange={(e) => setDraft({ ...draft, tracksVitamins: e.target.checked })}
          />
        </label>
        {draft.tracksVitamins && (
          <Field
            label="Название комплекса"
            value={draft.vitaminName}
            onChange={(vitaminName) => setDraft({ ...draft, vitaminName })}
          />
        )}
        <button
          onClick={async () => {
            await updateProfile(draft)
            setOverlay({ type: 'none' })
          }}
          className="h-14 w-full rounded-2xl bg-mint font-bold text-bg"
        >
          Сохранить
        </button>
        {supabaseEnabled && (
          <button onClick={signOut} className="h-12 w-full rounded-2xl bg-white/8 text-sm text-white/60">
            Выйти
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function Onboarding() {
  const { completeOnboarding } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('Дмитрий')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(35)
  const [heightCm, setHeightCm] = useState(178)
  const [weightKg, setWeightKg] = useState(90)
  const [goalWeightKg, setGoalWeightKg] = useState(82)

  const next = () => setStep((s) => s + 1)
  const save = () =>
    completeOnboarding({
      name,
      sex,
      age,
      heightCm,
      weightKg,
      goalWeightKg,
      calorieGoal: null,
      deficit: 500,
      onboardingComplete: true,
      tipsEnabled: true,
      waterGoalMl: 0,
      tracksVitamins: true,
      vitaminName: 'Комплекс витаминов',
    })

  return (
    <div className="flex min-h-full flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
      <div className="mb-6 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-mint' : 'bg-white/10'}`} />
        ))}
      </div>
      {step === 0 && (
        <Pane title="Это Форма" sub="Твой дневник еды, движения и веса. Один пользователь — ты.">
          <Field label="Как к тебе обращаться" value={name} onChange={setName} />
          <button onClick={next} className="mt-6 h-14 w-full rounded-2xl bg-mint font-bold text-bg">
            Дальше
          </button>
        </Pane>
      )}
      {step === 1 && (
        <Pane title="Кто ты" sub="Нужно для формулы калорий Mifflin–St Jeor.">
          <SexToggle value={sex} onChange={setSex} />
          <div className="mt-3">
            <Num label="Возраст" value={age} onChange={setAge} />
          </div>
          <button onClick={next} className="mt-6 h-14 w-full rounded-2xl bg-mint font-bold text-bg">
            Дальше
          </button>
        </Pane>
      )}
      {step === 2 && (
        <Pane title="Стартовые цифры" sub="Их всегда можно поменять.">
          <div className="grid grid-cols-2 gap-3">
            <Num label="Рост, см" value={heightCm} onChange={setHeightCm} />
            <Num label="Вес, кг" value={weightKg} step={0.1} onChange={setWeightKg} />
          </div>
          <button onClick={next} className="mt-6 h-14 w-full rounded-2xl bg-mint font-bold text-bg">
            Дальше
          </button>
        </Pane>
      )}
      {step === 3 && (
        <Pane title="Куда идём" sub="Цель по весу. Калории посчитаю сам, с дефицитом 500 ккал.">
          <Num label="Целевой вес, кг" value={goalWeightKg} step={0.1} onChange={setGoalWeightKg} />
          <button onClick={save} className="mt-6 h-14 w-full rounded-2xl bg-mint font-bold text-bg">
            Начать
          </button>
        </Pane>
      )}
    </div>
  )
}

function Pane({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 mb-6 text-white/50">{sub}</p>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/45">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
      />
    </label>
  )
}

function Num({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/45">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-12 w-full rounded-2xl bg-white/8 px-3 outline-none"
      />
    </label>
  )
}

function SexToggle({ value, onChange }: { value: Sex; onChange: (v: Sex) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['male', 'female'] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`h-12 rounded-2xl font-semibold ${value === s ? 'bg-mint text-bg' : 'bg-white/8'}`}
        >
          {s === 'male' ? 'Мужчина' : 'Женщина'}
        </button>
      ))}
    </div>
  )
}
