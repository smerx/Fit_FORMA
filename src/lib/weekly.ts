import type { ActivityEntry, FoodEntry, Profile, WaterEntry, WeightLog } from '../types'
import { lastNDates } from './dates'
import { dailyCalorieTarget, proteinTargetG, sumActivity, sumFood } from './nutrition'

export function weekReport(
  profile: Profile,
  endDate: string,
  foods: FoodEntry[],
  activities: ActivityEntry[],
  weights: WeightLog[],
  waters: WaterEntry[],
) {
  const days = lastNDates(endDate, 7)
  const target = dailyCalorieTarget(profile)
  const proteinNeed = proteinTargetG(profile)
  const perDay = days.map((date) => {
    const dayFood = foods.filter((e) => e.date === date)
    const dayAct = activities.filter((e) => e.date === date)
    const macros = sumFood(dayFood)
    const burned = sumActivity(dayAct)
    const deficit = target - macros.kcal + burned
    const water = waters.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0)
    const waterOrGoal = water > 0 ? water : profile.waterGoalMl
    return { date, macros, burned, deficit, water: waterOrGoal, logged: dayFood.length > 0 }
  })
  const logged = perDay.filter((d) => d.logged)
  const avg = (pick: (d: (typeof perDay)[number]) => number) =>
    logged.length ? Math.round(logged.reduce((s, d) => s + pick(d), 0) / logged.length) : 0

  const weekWeights = [...weights]
    .filter((w) => w.date >= days[0] && w.date <= days[days.length - 1])
    .sort((a, b) => a.date.localeCompare(b.date))
  const weightStart = weekWeights[0]?.weight
  const weightEnd = weekWeights.at(-1)?.weight
  const weightDelta =
    weightStart != null && weightEnd != null ? Math.round((weightEnd - weightStart) * 10) / 10 : null

  return {
    loggedDays: logged.length,
    avgEaten: avg((d) => d.macros.kcal),
    avgProtein: avg((d) => d.macros.protein),
    avgDeficit: avg((d) => d.deficit),
    avgWater: avg((d) => d.water),
    target,
    proteinNeed,
    waterGoal: profile.waterGoalMl,
    weightDelta,
    weightStart,
    weightEnd,
  }
}
