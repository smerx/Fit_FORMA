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
  favorites: string[]
  favoriteItems: FoodItem[]
  recentFoods: FoodItem[]
}

export type TabId = 'today' | 'diary' | 'activity' | 'progress'
