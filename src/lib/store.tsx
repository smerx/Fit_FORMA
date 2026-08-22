import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type {
  ActivityEntry,
  AppSnapshot,
  FoodEntry,
  FoodItem,
  MealType,
  Profile,
  TabId,
  VitaminEntry,
  WaterEntry,
  WeightLog,
} from '../types'
import { FOOD_BY_ID } from '../data/foods'
import { nid, todayIso } from './dates'
import { activityCalories, macrosForGrams, withProfileDefaults } from './nutrition'
import {
  deleteActivityRow,
  deleteFoodRow,
  deleteVitaminRow,
  deleteWaterRow,
  deleteWeightRow,
  fetchSnapshot,
  insertActivity,
  insertFood,
  insertVitamin,
  insertWater,
  insertWeight,
  setFavorite,
  supabase,
  supabaseEnabled,
  upsertProfile,
} from './supabase'

const STORAGE_KEY = 'forma-state-v1'

const empty: AppSnapshot = {
  profile: null,
  foodEntries: [],
  activityEntries: [],
  weightLogs: [],
  waterEntries: [],
  vitaminEntries: [],
  favorites: [],
  favoriteItems: [],
  recentFoods: [],
}

function loadLocal(): AppSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as AppSnapshot & { recentFoodIds?: string[] }
    const recentFoods =
      parsed.recentFoods ??
      (parsed.recentFoodIds ?? [])
        .map((id) => FOOD_BY_ID.get(id))
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    const favoriteItems =
      parsed.favoriteItems ??
      (parsed.favorites ?? [])
        .map((id) => FOOD_BY_ID.get(id))
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    return {
      ...empty,
      ...parsed,
      profile: parsed.profile ? withProfileDefaults(parsed.profile) : null,
      waterEntries: parsed.waterEntries ?? [],
      vitaminEntries: parsed.vitaminEntries ?? [],
      activityEntries: (parsed.activityEntries ?? []).map((e) => ({ ...e, note: e.note ?? '' })),
      recentFoods,
      favoriteItems,
    }
  } catch {
    return empty
  }
}

function saveLocal(state: AppSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

type Overlay =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'search'; meal: MealType }
  | { type: 'grams'; food: FoodItem; meal: MealType }
  | { type: 'activity'; activityId?: string }
  | { type: 'water' }
  | { type: 'custom-food'; meal: MealType }
  | { type: 'weight' }
  | { type: 'profile' }
  | { type: 'barcode'; meal: MealType }

type Store = {
  ready: boolean
  snapshot: AppSnapshot
  session: Session | null
  user: User | null
  supabaseEnabled: boolean
  authError: string | null
  syncHint: string | null
  tab: TabId
  date: string
  overlay: Overlay
  setTab: (tab: TabId) => void
  setDate: (date: string) => void
  setOverlay: (overlay: Overlay) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  completeOnboarding: (profile: Profile) => Promise<void>
  updateProfile: (patch: Partial<Profile>) => Promise<void>
  addFood: (food: FoodItem, grams: number, meal: MealType) => Promise<void>
  addCustomFood: (
    name: string,
    grams: number,
    per100: { kcal: number; protein: number; fat: number; carbs: number },
    meal: MealType,
  ) => Promise<void>
  removeFood: (id: string) => Promise<void>
  addActivityEntry: (input: {
    activityId: string
    name: string
    minutes: number
    met: number
    note?: string
  }) => Promise<void>
  removeActivity: (id: string) => Promise<void>
  addWeightLog: (weight: number, date?: string) => Promise<void>
  removeWeight: (id: string) => Promise<void>
  toggleFavorite: (food: FoodItem) => Promise<void>
  copyYesterday: () => Promise<void>
  addWater: (ml: number) => Promise<void>
  removeWater: (id: string) => Promise<void>
  toggleVitamin: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<AppSnapshot>(empty)
  const [session, setSession] = useState<Session | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [syncHint, setSyncHint] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('today')
  const [date, setDate] = useState(todayIso)
  const [overlay, setOverlay] = useState<Overlay>({ type: 'none' })

  const user = session?.user ?? null

  const commit = useCallback((next: AppSnapshot) => {
    setSnapshot(next)
    saveLocal(next)
  }, [])

  useEffect(() => {
    const local = loadLocal()
    setSnapshot(local)
    if (!supabase) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false
    fetchSnapshot(user.id)
      .then((remote) => {
        if (cancelled || !remote) return
        const local = loadLocal()
        const remoteFavs = remote.favorites
        const favoriteItems = [
          ...local.favoriteItems,
          ...remoteFavs
            .map((id) => FOOD_BY_ID.get(id))
            .filter((x): x is NonNullable<typeof x> => Boolean(x)),
        ].filter((item, i, arr) => arr.findIndex((x) => x.id === item.id) === i)
        const merged: AppSnapshot = {
          profile: remote.profile ?? local.profile,
          foodEntries: remote.foodEntries.length ? remote.foodEntries : local.foodEntries,
          activityEntries: remote.activityEntries.length
            ? remote.activityEntries
            : local.activityEntries,
          weightLogs: remote.weightLogs.length ? remote.weightLogs : local.weightLogs,
          waterEntries: remote.waterEntries.length ? remote.waterEntries : local.waterEntries,
          vitaminEntries: remote.vitaminEntries.length ? remote.vitaminEntries : local.vitaminEntries,
          favorites: remoteFavs.length ? remoteFavs : local.favorites,
          favoriteItems: favoriteItems.length ? favoriteItems : local.favoriteItems,
          recentFoods: local.recentFoods,
        }
        commit(merged)
      })
      .catch(() => setSyncHint('Облако недоступно, работаем локально'))
    return () => {
      cancelled = true
    }
  }, [user, commit])

  const runCloud = useCallback(async (fn: () => Promise<void>) => {
    if (!user || !supabase) return
    try {
      await fn()
      setSyncHint(null)
    } catch {
      setSyncHint('Не удалось сохранить в облако, данные на устройстве')
    }
  }, [user])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return
    setAuthError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setAuthError(error.message)
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const completeOnboarding = useCallback(
    async (profile: Profile) => {
      const readyProfile = withProfileDefaults(profile)
      const weight: WeightLog = {
        id: nid(),
        date: todayIso(),
        weight: readyProfile.weightKg,
        createdAt: new Date().toISOString(),
      }
      const next: AppSnapshot = {
        ...snapshot,
        profile: readyProfile,
        weightLogs: [...snapshot.weightLogs, weight],
      }
      commit(next)
      await runCloud(async () => {
        if (!user) return
        await upsertProfile(user.id, readyProfile)
        await insertWeight(user.id, weight)
      })
    },
    [snapshot, commit, runCloud, user],
  )

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!snapshot.profile) return
      const profile = withProfileDefaults({ ...snapshot.profile, ...patch })
      commit({ ...snapshot, profile })
      await runCloud(async () => {
        if (!user) return
        await upsertProfile(user.id, profile)
      })
    },
    [snapshot, commit, runCloud, user],
  )

  const addFood = useCallback(
    async (food: FoodItem, grams: number, meal: MealType) => {
      const macros = macrosForGrams(food, grams)
      const entry: FoodEntry = {
        id: nid(),
        date,
        meal,
        foodId: food.id,
        name: food.name,
        form: food.form,
        grams,
        ...macros,
        image: food.image,
        emoji: food.emoji,
        source: food.id.startsWith('off-') ? 'off' : food.id.startsWith('custom-') ? 'custom' : 'local',
        createdAt: new Date().toISOString(),
      }
      const next: AppSnapshot = {
        ...snapshot,
        foodEntries: [...snapshot.foodEntries, entry],
        recentFoods: [food, ...snapshot.recentFoods.filter((f) => f.id !== food.id)].slice(0, 20),
      }
      commit(next)
      setOverlay({ type: 'none' })
      await runCloud(async () => {
        if (!user) return
        await insertFood(user.id, entry)
      })
    },
    [snapshot, date, commit, runCloud, user],
  )

  const addCustomFood = useCallback(
    async (
      name: string,
      grams: number,
      per100: { kcal: number; protein: number; fat: number; carbs: number },
      meal: MealType,
    ) => {
      const food: FoodItem = {
        id: `custom-${nid()}`,
        name,
        aliases: [name.toLowerCase()],
        category: 'Своё',
        form: 'as_is',
        ...per100,
        emoji: '✏️',
      }
      await addFood(food, grams, meal)
    },
    [addFood],
  )

  const removeFood = useCallback(
    async (id: string) => {
      commit({
        ...snapshot,
        foodEntries: snapshot.foodEntries.filter((e) => e.id !== id),
      })
      await runCloud(async () => {
        if (!user) return
        await deleteFoodRow(user.id, id)
      })
    },
    [snapshot, commit, runCloud, user],
  )

  const addActivityEntry = useCallback(
    async (input: { activityId: string; name: string; minutes: number; met: number; note?: string }) => {
      const weight = snapshot.profile?.weightKg ?? 80
      const entry: ActivityEntry = {
        id: nid(),
        date,
        activityId: input.activityId,
        name: input.name,
        minutes: input.minutes,
        met: input.met,
        kcal: activityCalories(input.met, weight, input.minutes),
        note: input.note?.trim() ?? '',
        createdAt: new Date().toISOString(),
      }
      commit({ ...snapshot, activityEntries: [...snapshot.activityEntries, entry] })
      setOverlay({ type: 'none' })
      await runCloud(async () => {
        if (!user) return
        await insertActivity(user.id, entry)
      })
    },
    [snapshot, date, commit, runCloud, user],
  )

  const removeActivity = useCallback(
    async (id: string) => {
      commit({
        ...snapshot,
        activityEntries: snapshot.activityEntries.filter((e) => e.id !== id),
      })
      await runCloud(async () => {
        if (!user) return
        await deleteActivityRow(user.id, id)
      })
    },
    [snapshot, commit, runCloud, user],
  )

  const addWeightLog = useCallback(
    async (weight: number, logDate = date) => {
      const entry: WeightLog = {
        id: nid(),
        date: logDate,
        weight,
        createdAt: new Date().toISOString(),
      }
      const profile = snapshot.profile
        ? { ...snapshot.profile, weightKg: weight }
        : snapshot.profile
      commit({
        ...snapshot,
        profile,
        weightLogs: [...snapshot.weightLogs, entry],
      })
      setOverlay({ type: 'none' })
      await runCloud(async () => {
        if (!user) return
        await insertWeight(user.id, entry)
        if (profile) await upsertProfile(user.id, profile)
      })
    },
    [snapshot, date, commit, runCloud, user],
  )

  const removeWeight = useCallback(
    async (id: string) => {
      commit({
        ...snapshot,
        weightLogs: snapshot.weightLogs.filter((e) => e.id !== id),
      })
      await runCloud(async () => {
        if (!user) return
        await deleteWeightRow(user.id, id)
      })
    },
    [snapshot, commit, runCloud, user],
  )

  const toggleFavorite = useCallback(
    async (food: FoodItem) => {
      const on = !snapshot.favorites.includes(food.id)
      const favorites = on
        ? [...snapshot.favorites, food.id]
        : snapshot.favorites.filter((id) => id !== food.id)
      const favoriteItems = on
        ? [food, ...snapshot.favoriteItems.filter((f) => f.id !== food.id)]
        : snapshot.favoriteItems.filter((f) => f.id !== food.id)
      commit({ ...snapshot, favorites, favoriteItems })
      await runCloud(async () => {
        if (!user) return
        await setFavorite(user.id, food.id, on)
      })
    },
    [snapshot, commit, runCloud, user],
  )

  const copyYesterday = useCallback(async () => {
    const y = new Date(`${date}T12:00:00`)
    y.setDate(y.getDate() - 1)
    const yIso = y.toISOString().slice(0, 10)
    const cloned = snapshot.foodEntries
      .filter((e) => e.date === yIso)
      .map((e) => ({
        ...e,
        id: nid(),
        date,
        createdAt: new Date().toISOString(),
      }))
    if (!cloned.length) return
    commit({ ...snapshot, foodEntries: [...snapshot.foodEntries, ...cloned] })
    await runCloud(async () => {
      if (!user) return
      for (const entry of cloned) await insertFood(user.id, entry)
    })
  }, [snapshot, date, commit, runCloud, user])

  const addWater = useCallback(
    async (ml: number) => {
      if (ml <= 0) return
      const entry: WaterEntry = {
        id: nid(),
        date,
        ml,
        createdAt: new Date().toISOString(),
      }
      commit({ ...snapshot, waterEntries: [...snapshot.waterEntries, entry] })
      setOverlay({ type: 'none' })
      await runCloud(async () => {
        if (!user) return
        await insertWater(user.id, entry)
      })
    },
    [snapshot, date, commit, runCloud, user],
  )

  const removeWater = useCallback(
    async (id: string) => {
      commit({
        ...snapshot,
        waterEntries: snapshot.waterEntries.filter((e) => e.id !== id),
      })
      await runCloud(async () => {
        if (!user) return
        await deleteWaterRow(user.id, id)
      })
    },
    [snapshot, commit, runCloud, user],
  )

  const toggleVitamin = useCallback(async () => {
    const existing = snapshot.vitaminEntries.find((v) => v.date === date)
    if (existing) {
      commit({
        ...snapshot,
        vitaminEntries: snapshot.vitaminEntries.filter((v) => v.id !== existing.id),
      })
      await runCloud(async () => {
        if (!user) return
        await deleteVitaminRow(user.id, existing.id)
      })
      return
    }
    const entry: VitaminEntry = {
      id: nid(),
      date,
      name: snapshot.profile?.vitaminName ?? 'Комплекс витаминов',
      createdAt: new Date().toISOString(),
    }
    commit({ ...snapshot, vitaminEntries: [...snapshot.vitaminEntries, entry] })
    await runCloud(async () => {
      if (!user) return
      await insertVitamin(user.id, entry)
    })
  }, [snapshot, date, commit, runCloud, user])

  const value = useMemo<Store>(
    () => ({
      ready,
      snapshot,
      session,
      user,
      supabaseEnabled,
      authError,
      syncHint,
      tab,
      date,
      overlay,
      setTab,
      setDate,
      setOverlay,
      signIn,
      signUp,
      signOut,
      completeOnboarding,
      updateProfile,
      addFood,
      addCustomFood,
      removeFood,
      addActivityEntry,
      removeActivity,
      addWeightLog,
      removeWeight,
      toggleFavorite,
      copyYesterday,
      addWater,
      removeWater,
      toggleVitamin,
    }),
    [
      ready,
      snapshot,
      session,
      user,
      authError,
      syncHint,
      tab,
      date,
      overlay,
      signIn,
      signUp,
      signOut,
      completeOnboarding,
      updateProfile,
      addFood,
      addCustomFood,
      removeFood,
      addActivityEntry,
      removeActivity,
      addWeightLog,
      removeWeight,
      toggleFavorite,
      copyYesterday,
      addWater,
      removeWater,
      toggleVitamin,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Store missing')
  return ctx
}
