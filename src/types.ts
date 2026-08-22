export type FoodForm = 'dry' | 'cooked' | 'as_is'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Sex = 'male' | 'female'

export type FoodSource = 'local' | 'off' | 'custom'

export type FoodItem = {
  id: string
  name: string
  aliases: string[]
  category: string
  form: FoodForm
  kcal: number
  protein: number
  fat: number
  carbs: number
  emoji: string
  image?: string
  pairId?: string
}

export type FoodEntry = {
  id: string
  date: string
  meal: MealType
  foodId?: string
  name: string
  form?: FoodForm
  grams: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  image?: string
  emoji?: string
  source: FoodSource
  createdAt: string
}

export type ActivityEntry = {
  id: string
  date: string
  activityId: string
  name: string
  minutes: number
  met: number
  kcal: number
  note: string
  createdAt: string
}

export type WeightLog = {
  id: string
  date: string
  weight: number
  createdAt: string
}

export type Profile = {
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  goalWeightKg: number
  calorieGoal: number | null
  deficit: number
  onboardingComplete: boolean
  tipsEnabled: boolean
  waterGoalMl: number
  tracksVitamins: boolean
  vitaminName: string
}

export type WaterEntry = {
  id: string
  date: string
  ml: number
  createdAt: string
}

export type VitaminEntry = {
  id: string
  date: string
  name: string
  createdAt: string
}

export type HealthTip = {
  id: string
  title: string
  why: string
  fact: string
  tone: 'info' | 'warn' | 'good'
}

export type ActivityTemplate = {
  id: string
  name: string
  met: number
  emoji: string
  hint: string
  custom?: boolean
}

export type AppSnapshot = {
  profile: Profile | null
  foodEntries: FoodEntry[]
  activityEntries: ActivityEntry[]
  weightLogs: WeightLog[]
  waterEntries: WaterEntry[]
  vitaminEntries: VitaminEntry[]
  favorites: string[]
  favoriteItems: FoodItem[]
  recentFoods: FoodItem[]
}

export type TabId = 'today' | 'diary' | 'activity' | 'progress'
