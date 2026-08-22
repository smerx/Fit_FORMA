import type { ActivityEntry, FoodEntry, HealthTip, Profile, VitaminEntry } from '../types'
import { todayIso } from './dates'
import {
  dailyCalorieTarget,
  fatFloorG,
  proteinTargetG,
  sumFood,
} from './nutrition'

type TipInput = {
  profile: Profile
  date: string
  foods: FoodEntry[]
  activities: ActivityEntry[]
  waterMl: number
  vitamins: VitaminEntry[]
  dismissed: string[]
}

export function pickHealthTip(input: TipInput): HealthTip | null {
  if (!input.profile.tipsEnabled) return null
  const tips = buildTips(input)
  return tips.find((t) => !input.dismissed.includes(t.id)) ?? null
}

function buildTips(input: TipInput): HealthTip[] {
  const { profile, date, foods, vitamins } = input
  const hour = date === todayIso() ? new Date().getHours() : 20
  const eaten = sumFood(foods)
  const target = dailyCalorieTarget(profile)
  const proteinNeed = proteinTargetG(profile)
  const fatNeed = fatFloorG(profile)
  const out: HealthTip[] = []

  if (hour >= 13 && foods.length === 0) {
    out.push({
      id: 'empty-log',
      title: 'День пока пустой',
      why: 'Если есть, а в дневнике пусто, цифры «осталось» врут. И наоборот: если реально голодаешь до обеда, мозг и тренировки это чувствуют.',
      fact: 'Мозг почти целиком на глюкозе. Долгий голод без еды даёт туман в голове и срывы вечером — не «силу воли сломало», а физиологию.',
      tone: 'info',
    })
  }

  if (eaten.kcal > 400 && eaten.fat < fatNeed * 0.6) {
    out.push({
      id: 'fat-low',
      title: 'Жира в рационе мало',
      why: `Сегодня ${Math.round(eaten.fat)} г при разумном минимуме около ${fatNeed} г. На похудении жир режут первым — и зря до нуля.`,
      fact: 'Мозг ~60% сухой массы — липиды. Жиры нужны мембранам нейронов и гормонам. Витамины A, D, E, K без жира из еды почти не усваиваются.',
      tone: 'warn',
    })
  }

  if (eaten.kcal > 400 && eaten.protein < proteinNeed * 0.7) {
    out.push({
      id: 'protein-low',
      title: 'Белка мало для дефицита',
      why: `Съедено ${Math.round(eaten.protein)} г, ориентир около ${proteinNeed} г (1.6 г на кг). В дефиците тело любит есть мышцы, не только жир.`,
      fact: 'Белок держит мышечную массу и сытость. Пока худеешь, 1.6 г/кг — рабочая норма спортивного питания, не «качковский перебор».',
      tone: 'warn',
    })
  }

  if (eaten.kcal > 200 && target - eaten.kcal > 900) {
    out.push({
      id: 'deficit-harsh',
      title: 'Очень большой недоеденный кусок',
      why: 'Слишком жёсткий день часто кончается ночным срывом и потерей мышц. 300–700 ккал дефицита обычно устойчивее, чем «геройский» голод.',
      fact: 'Хронический недоедаж роняет тестостерон, щитовидку и восстановление. Вес может падать, но сила и настроение — тоже.',
      tone: 'warn',
    })
  }

  if (profile.tracksVitamins && hour >= 14 && !vitamins.some((v) => v.date === date)) {
    out.push({
      id: 'vitamin-miss',
      title: `Не отмечен ${profile.vitaminName.toLowerCase()}`,
      why: 'Если пьёшь комплекс курсом, пропуски делают его бессмысленным. Лучше с едой, особенно если в составе A, D, E, K.',
      fact: 'Жирорастворимые витамины усваиваются вместе с жиром из тарелки. На голодный желудок часть дозы проходит мимо. Это не замена анализам и не лечение — просто привычка.',
      tone: 'info',
    })
  }

  if (eaten.kcal > 400 && eaten.protein >= proteinNeed * 0.9) {
    out.push({
      id: 'good-day',
      title: 'Белок на месте',
      why: 'Так дефицит переносится спокойнее: лучше сытость, мышцы не первые в очереди на сжигание.',
      fact: 'Белок держит мышечную массу. 1.6 г/кг — рабочая норма, пока худеешь.',
      tone: 'good',
    })
  }

  return out
}
