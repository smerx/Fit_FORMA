import type { ActivityEntry, FoodEntry, Profile } from '../types'

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function macrosForGrams(
  per100: { kcal: number; protein: number; fat: number; carbs: number },
  grams: number,
) {
  const k = grams / 100
  return {
    kcal: Math.round(per100.kcal * k),
    protein: round1(per100.protein * k),
    fat: round1(per100.fat * k),
    carbs: round1(per100.carbs * k),
  }
}

export function bmr(profile: Profile): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age
  return Math.round(profile.sex === 'male' ? base + 5 : base - 161)
}

export function activityCalories(met: number, weightKg: number, minutes: number): number {
  return Math.round(met * weightKg * (minutes / 60))
}

export function dailyCalorieTarget(profile: Profile): number {
  if (profile.calorieGoal && profile.calorieGoal > 0) return profile.calorieGoal
  const sedentary = Math.round(bmr(profile) * 1.2)
  return Math.max(1200, sedentary - profile.deficit)
}

export function sumFood(entries: FoodEntry[]) {
  return entries.reduce(
    (acc, e) => {
      acc.kcal += e.kcal
      acc.protein += e.protein
      acc.fat += e.fat
      acc.carbs += e.carbs
      return acc
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  )
}

export function sumActivity(entries: ActivityEntry[]): number {
  return entries.reduce((s, e) => s + e.kcal, 0)
}

export function remainingCalories(
  profile: Profile,
  food: FoodEntry[],
  activity: ActivityEntry[],
): number {
  return dailyCalorieTarget(profile) - sumFood(food).kcal + sumActivity(activity)
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return round1(weightKg / (m * m))
}

export function weeksToGoal(profile: Profile): number | null {
  const delta = profile.weightKg - profile.goalWeightKg
  if (Math.abs(delta) < 0.2) return 0
  const kgPerWeek = (profile.deficit * 7) / 7700
  if (kgPerWeek <= 0) return null
  return Math.max(1, Math.ceil(Math.abs(delta) / kgPerWeek))
}

export function proteinTargetG(profile: Profile): number {
  return Math.round(1.6 * profile.weightKg)
}

export function fatFloorG(profile: Profile): number {
  return Math.max(40, Math.round(0.8 * profile.weightKg))
}

export function defaultWaterGoalMl(weightKg: number): number {
  return Math.min(3500, Math.max(1800, Math.round(weightKg * 35)))
}

export function withProfileDefaults(profile: Profile): Profile {
  return {
    ...profile,
    tipsEnabled: profile.tipsEnabled ?? true,
    waterGoalMl:
      profile.waterGoalMl && profile.waterGoalMl > 0
        ? profile.waterGoalMl
        : defaultWaterGoalMl(profile.weightKg),
    tracksVitamins: profile.tracksVitamins ?? true,
    vitaminName: profile.vitaminName?.trim() || 'Комплекс витаминов',
  }
}
