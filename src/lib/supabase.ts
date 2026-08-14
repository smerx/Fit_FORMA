import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  ActivityEntry,
  AppSnapshot,
  FoodEntry,
  FoodForm,
  FoodSource,
  MealType,
  Profile,
  Sex,
  WeightLog,
} from '../types'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const supabaseEnabled = Boolean(supabaseUrl && supabaseKey)

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(supabaseUrl, supabaseKey)
  : null

type ProfileRow = {
  id: string
  name: string
  sex: Sex
  age: number
  height_cm: number
  weight_kg: number
  goal_weight_kg: number
  calorie_goal: number | null
  deficit: number
  onboarding_complete: boolean
}

type FoodRow = {
  id: string
  logged_on: string
  meal: MealType
  food_id: string | null
  name: string
  form: FoodForm | null
  grams: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  image: string | null
  emoji: string | null
  source: FoodSource
  created_at: string
}

type ActivityRow = {
  id: string
  logged_on: string
  activity_id: string
  name: string
  minutes: number
  met: number
  kcal: number
  created_at: string
}

type WeightRow = {
  id: string
  logged_on: string
  weight: number
  created_at: string
}

type FavRow = {
  food_key: string
}

export function profileFromRow(row: ProfileRow): Profile {
  return {
    name: row.name,
    sex: row.sex,
    age: row.age,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    goalWeightKg: Number(row.goal_weight_kg),
    calorieGoal: row.calorie_goal,
    deficit: row.deficit,
    onboardingComplete: row.onboarding_complete,
  }
}

export function foodFromRow(row: FoodRow): FoodEntry {
  return {
    id: row.id,
    date: row.logged_on,
    meal: row.meal,
    foodId: row.food_id ?? undefined,
    name: row.name,
    form: row.form ?? undefined,
    grams: Number(row.grams),
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    fat: Number(row.fat),
    carbs: Number(row.carbs),
    image: row.image ?? undefined,
    emoji: row.emoji ?? undefined,
    source: row.source,
    createdAt: row.created_at,
  }
}

export async function fetchSnapshot(userId: string): Promise<AppSnapshot | null> {
  if (!supabase) return null
  const [profileRes, foodRes, actRes, weightRes, favRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('food_entries').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('activity_entries').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('weight_logs').select('*').eq('user_id', userId).order('logged_on'),
    supabase.from('favorite_foods').select('food_key').eq('user_id', userId),
  ])

  const profile = profileRes.data ? profileFromRow(profileRes.data as ProfileRow) : null
  return {
    profile,
    foodEntries: ((foodRes.data ?? []) as FoodRow[]).map(foodFromRow),
    activityEntries: ((actRes.data ?? []) as ActivityRow[]).map((row) => ({
      id: row.id,
      date: row.logged_on,
      activityId: row.activity_id,
      name: row.name,
      minutes: row.minutes,
      met: Number(row.met),
      kcal: Number(row.kcal),
      createdAt: row.created_at,
    })),
    weightLogs: ((weightRes.data ?? []) as WeightRow[]).map((row) => ({
      id: row.id,
      date: row.logged_on,
      weight: Number(row.weight),
      createdAt: row.created_at,
    })),
    favorites: ((favRes.data ?? []) as FavRow[]).map((r) => r.food_key),
    favoriteItems: [],
    recentFoods: [],
  }
}

export async function upsertProfile(userId: string, profile: Profile) {
  if (!supabase) return
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    name: profile.name,
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    goal_weight_kg: profile.goalWeightKg,
    calorie_goal: profile.calorieGoal,
    deficit: profile.deficit,
    onboarding_complete: profile.onboardingComplete,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function insertFood(userId: string, entry: FoodEntry) {
  if (!supabase) return
  const { error } = await supabase.from('food_entries').insert({
    id: entry.id,
    user_id: userId,
    logged_on: entry.date,
    meal: entry.meal,
    food_id: entry.foodId ?? null,
    name: entry.name,
    form: entry.form ?? null,
    grams: entry.grams,
    kcal: entry.kcal,
    protein: entry.protein,
    fat: entry.fat,
    carbs: entry.carbs,
    image: entry.image ?? null,
    emoji: entry.emoji ?? null,
    source: entry.source,
    created_at: entry.createdAt,
  })
  if (error) throw error
}

export async function deleteFoodRow(userId: string, id: string) {
  if (!supabase) return
  const { error } = await supabase.from('food_entries').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function insertActivity(userId: string, entry: ActivityEntry) {
  if (!supabase) return
  const { error } = await supabase.from('activity_entries').insert({
    id: entry.id,
    user_id: userId,
    logged_on: entry.date,
    activity_id: entry.activityId,
    name: entry.name,
    minutes: entry.minutes,
    met: entry.met,
    kcal: entry.kcal,
    created_at: entry.createdAt,
  })
  if (error) throw error
}

export async function deleteActivityRow(userId: string, id: string) {
  if (!supabase) return
  const { error } = await supabase.from('activity_entries').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function insertWeight(userId: string, entry: WeightLog) {
  if (!supabase) return
  const { error } = await supabase.from('weight_logs').insert({
    id: entry.id,
    user_id: userId,
    logged_on: entry.date,
    weight: entry.weight,
    created_at: entry.createdAt,
  })
  if (error) throw error
}

export async function deleteWeightRow(userId: string, id: string) {
  if (!supabase) return
  const { error } = await supabase.from('weight_logs').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function setFavorite(userId: string, foodKey: string, on: boolean) {
  if (!supabase) return
  if (on) {
    const { error } = await supabase.from('favorite_foods').upsert({
      user_id: userId,
      food_key: foodKey,
    })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('favorite_foods')
      .delete()
      .eq('user_id', userId)
      .eq('food_key', foodKey)
    if (error) throw error
  }
}
