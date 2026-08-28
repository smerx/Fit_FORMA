import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { nid, shiftIso, todayIso } from './dates'
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
const PENDING_KEY = 'forma-pending-v1'
const ACTIVE_USER_KEY = 'forma-active-user-v1'

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

function saveLocal(state: AppSnapshot): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const rows = new Map(remote.map((row) => [row.id, row]))
  for (const row of local) rows.set(row.id, row)
  return [...rows.values()]
}

function mergeSnapshots(local: AppSnapshot, remote: AppSnapshot): AppSnapshot {
  const favorites = [...new Set([...remote.favorites, ...local.favorites])]
  const favoriteItems = [...local.favoriteItems, ...remote.favoriteItems].filter(
    (item, index, rows) => rows.findIndex((row) => row.id === item.id) === index,
  )
  return {
    profile: remote.profile ?? local.profile,
    foodEntries: mergeById(remote.foodEntries, local.foodEntries),
    activityEntries: mergeById(remote.activityEntries, local.activityEntries),
    weightLogs: mergeById(remote.weightLogs, local.weightLogs),
    waterEntries: mergeById(remote.waterEntries, local.waterEntries),
    vitaminEntries: mergeById(remote.vitaminEntries, local.vitaminEntries),
    favorites,
    favoriteItems,
    recentFoods: local.recentFoods,
  }
}

type PendingMutation =
  | { key: string; kind: 'profile'; profile: Profile }
  | { key: string; kind: 'food-insert'; entry: FoodEntry }
  | { key: string; kind: 'food-delete'; id: string }
  | { key: string; kind: 'activity-insert'; entry: ActivityEntry }
  | { key: string; kind: 'activity-delete'; id: string }
  | { key: string; kind: 'weight-insert'; entry: WeightLog }
  | { key: string; kind: 'weight-delete'; id: string }
  | { key: string; kind: 'water-insert'; entry: WaterEntry }
  | { key: string; kind: 'water-delete'; id: string }
  | { key: string; kind: 'vitamin-insert'; entry: VitaminEntry }
  | { key: string; kind: 'vitamin-delete'; id: string }
  | { key: string; kind: 'favorite'; foodId: string; on: boolean }

type DeletedEntryIds = {
  food: Set<string>
  activity: Set<string>
  weight: Set<string>
  water: Set<string>
  vitamin: Set<string>
}

function emptyDeletedEntryIds(): DeletedEntryIds {
  return {
    food: new Set(),
    activity: new Set(),
    weight: new Set(),
    water: new Set(),
    vitamin: new Set(),
  }
}

function collectPendingDeletes(rows: PendingMutation[]): DeletedEntryIds {
  const deleted = emptyDeletedEntryIds()
  for (const row of rows) {
    if (row.kind === 'food-delete') deleted.food.add(row.id)
    if (row.kind === 'activity-delete') deleted.activity.add(row.id)
    if (row.kind === 'weight-delete') deleted.weight.add(row.id)
    if (row.kind === 'water-delete') deleted.water.add(row.id)
    if (row.kind === 'vitamin-delete') deleted.vitamin.add(row.id)
  }
  return deleted
}

function withoutDeleted(snapshot: AppSnapshot, deleted: DeletedEntryIds): AppSnapshot {
  return {
    ...snapshot,
    foodEntries: snapshot.foodEntries.filter((row) => !deleted.food.has(row.id)),
    activityEntries: snapshot.activityEntries.filter((row) => !deleted.activity.has(row.id)),
    weightLogs: snapshot.weightLogs.filter((row) => !deleted.weight.has(row.id)),
    waterEntries: snapshot.waterEntries.filter((row) => !deleted.water.has(row.id)),
    vitaminEntries: snapshot.vitaminEntries.filter((row) => !deleted.vitamin.has(row.id)),
  }
}

function applyPendingMutations(
  snapshot: AppSnapshot,
  mutations: PendingMutation[],
): AppSnapshot {
  let next = snapshot
  for (const mutation of mutations) {
    switch (mutation.kind) {
      case 'profile':
        next = { ...next, profile: mutation.profile }
        break
      case 'food-insert':
        next = { ...next, foodEntries: mergeById(next.foodEntries, [mutation.entry]) }
        break
      case 'food-delete':
        next = { ...next, foodEntries: next.foodEntries.filter((row) => row.id !== mutation.id) }
        break
      case 'activity-insert':
        next = { ...next, activityEntries: mergeById(next.activityEntries, [mutation.entry]) }
        break
      case 'activity-delete':
        next = {
          ...next,
          activityEntries: next.activityEntries.filter((row) => row.id !== mutation.id),
        }
        break
      case 'weight-insert':
        next = { ...next, weightLogs: mergeById(next.weightLogs, [mutation.entry]) }
        break
      case 'weight-delete':
        next = { ...next, weightLogs: next.weightLogs.filter((row) => row.id !== mutation.id) }
        break
      case 'water-insert':
        next = { ...next, waterEntries: mergeById(next.waterEntries, [mutation.entry]) }
        break
      case 'water-delete':
        next = { ...next, waterEntries: next.waterEntries.filter((row) => row.id !== mutation.id) }
        break
      case 'vitamin-insert':
        next = { ...next, vitaminEntries: mergeById(next.vitaminEntries, [mutation.entry]) }
        break
      case 'vitamin-delete':
        next = {
          ...next,
          vitaminEntries: next.vitaminEntries.filter((row) => row.id !== mutation.id),
        }
        break
      case 'favorite': {
        const favorites = mutation.on
          ? [...new Set([...next.favorites, mutation.foodId])]
          : next.favorites.filter((id) => id !== mutation.foodId)
        next = { ...next, favorites }
        break
      }
    }
  }
  return next
}

function pendingStorageKey(userId: string): string {
  return `${PENDING_KEY}:${userId}`
}

function loadPending(userId: string): PendingMutation[] {
  try {
    const raw = localStorage.getItem(pendingStorageKey(userId))
    return raw ? (JSON.parse(raw) as PendingMutation[]) : []
  } catch {
    return []
  }
}

function savePending(userId: string, rows: PendingMutation[]) {
  try {
    if (rows.length) {
      localStorage.setItem(pendingStorageKey(userId), JSON.stringify(rows))
    } else {
      localStorage.removeItem(pendingStorageKey(userId))
    }
  } catch {
    /* основной snapshot всё равно остаётся локально */
  }
}

function queuePending(userId: string, mutation: PendingMutation) {
  const rows = loadPending(userId).filter((row) => row.key !== mutation.key)
  rows.push(mutation)
  savePending(userId, rows)
}

function clearPending(userId: string, key: string) {
  savePending(
    userId,
    loadPending(userId).filter((row) => row.key !== key),
  )
}

async function executePending(userId: string, mutation: PendingMutation) {
  switch (mutation.kind) {
    case 'profile':
      return upsertProfile(userId, mutation.profile)
    case 'food-insert':
      return insertFood(userId, mutation.entry)
    case 'food-delete':
      return deleteFoodRow(userId, mutation.id)
    case 'activity-insert':
      return insertActivity(userId, mutation.entry)
    case 'activity-delete':
      return deleteActivityRow(userId, mutation.id)
    case 'weight-insert':
      return insertWeight(userId, mutation.entry)
    case 'weight-delete':
      return deleteWeightRow(userId, mutation.id)
    case 'water-insert':
      return insertWater(userId, mutation.entry)
    case 'water-delete':
      return deleteWaterRow(userId, mutation.id)
    case 'vitamin-insert':
      return insertVitamin(userId, mutation.entry)
    case 'vitamin-delete':
      return deleteVitaminRow(userId, mutation.id)
    case 'favorite':
      return setFavorite(userId, mutation.foodId, mutation.on)
  }
}

type Overlay =
  | { type: 'none' }
  | { type: 'add'; date: string; followToday: boolean }
  | { type: 'search'; meal: MealType; date: string; followToday: boolean }
  | { type: 'grams'; food: FoodItem; meal: MealType; date: string; followToday: boolean }
  | { type: 'activity'; date: string; followToday: boolean; activityId?: string }
  | { type: 'water'; date: string; followToday: boolean }
  | {
      type: 'custom-food'
      meal: MealType
      date: string
      followToday: boolean
      draftName?: string
      barcode?: string
    }
  | { type: 'weight'; date: string; followToday: boolean }
  | { type: 'profile' }
  | { type: 'barcode'; meal: MealType; date: string; followToday: boolean }

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
  addFood: (food: FoodItem, grams: number, meal: MealType, date: string) => Promise<void>
  addCustomFood: (
    name: string,
    grams: number,
    per100: { kcal: number; protein: number; fat: number; carbs: number },
    meal: MealType,
    date: string,
  ) => Promise<void>
  removeFood: (id: string) => Promise<void>
  addActivityEntry: (input: {
    activityId: string
    name: string
    minutes: number
    met: number
    note?: string
    date: string
  }) => Promise<void>
  removeActivity: (id: string) => Promise<void>
  addWeightLog: (weight: number, date: string) => Promise<void>
  removeWeight: (id: string) => Promise<void>
  toggleFavorite: (food: FoodItem) => Promise<void>
  copyYesterday: (date: string) => Promise<void>
  addWater: (ml: number, date: string) => Promise<void>
  removeWater: (id: string) => Promise<void>
  toggleVitamin: (date: string) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<AppSnapshot>(empty)
  const [session, setSession] = useState<Session | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [syncHint, setSyncHint] = useState<string | null>(null)
  const [tab, setTabState] = useState<TabId>('today')
  const [date, setDateState] = useState(todayIso)
  const [overlay, setOverlay] = useState<Overlay>({ type: 'none' })
  const followsTodayRef = useRef(true)
  const tabRef = useRef<TabId>('today')
  const flushingRef = useRef(false)
  const deletedIdsRef = useRef<DeletedEntryIds>(emptyDeletedEntryIds())
  const actionLocksRef = useRef(new Set<string>())

  const user = session?.user ?? null

  const setDate = useCallback((next: string) => {
    followsTodayRef.current = next === todayIso()
    setDateState(next)
  }, [])

  const setTab = useCallback((next: TabId) => {
    tabRef.current = next
    setTabState(next)
    if (next !== 'diary') {
      followsTodayRef.current = true
      setDateState(todayIso())
    }
  }, [])

  useEffect(() => {
    let midnightTimer = 0

    const syncCalendarDay = () => {
      const today = todayIso()
      if (tabRef.current !== 'diary' || followsTodayRef.current) setDateState(today)
      setOverlay((current) => {
        if ('followToday' in current && current.followToday && current.date !== today) {
          return { ...current, date: today }
        }
        return current
      })
    }

    const scheduleMidnight = () => {
      window.clearTimeout(midnightTimer)
      const now = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 1, 0)
      midnightTimer = window.setTimeout(() => {
        syncCalendarDay()
        scheduleMidnight()
      }, next.getTime() - now.getTime())
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncCalendarDay()
    }

    syncCalendarDay()
    scheduleMidnight()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', syncCalendarDay)
    window.addEventListener('pageshow', syncCalendarDay)
    return () => {
      window.clearTimeout(midnightTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', syncCalendarDay)
      window.removeEventListener('pageshow', syncCalendarDay)
    }
  }, [])

  const commit = useCallback((update: AppSnapshot | ((current: AppSnapshot) => AppSnapshot)) => {
    setSnapshot((current) => {
      const next = typeof update === 'function' ? update(current) : update
      if (!saveLocal(next)) {
        queueMicrotask(() =>
          setSyncHint('Не удалось сохранить на устройстве: проверь свободное место'),
        )
      }
      return next
    })
  }, [])

  useEffect(() => {
    const local = loadLocal()
    setSnapshot(local)
    if (!supabase) {
      setReady(true)
      return
    }
    const acceptSession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id
      if (nextUserId) {
        const previousUserId = localStorage.getItem(ACTIVE_USER_KEY)
        if (previousUserId && previousUserId !== nextUserId) {
          localStorage.removeItem(STORAGE_KEY)
          setSnapshot(empty)
        }
        localStorage.setItem(ACTIVE_USER_KEY, nextUserId)
      }
      setSession(nextSession)
    }
    supabase.auth.getSession().then(({ data }) => {
      acceptSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      acceptSession(nextSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !user) return
    const pendingAtStart = loadPending(user.id)
    deletedIdsRef.current = collectPendingDeletes(pendingAtStart)
    let cancelled = false
    fetchSnapshot(user.id)
      .then((remote) => {
        if (cancelled || !remote) return
        const remoteFavoriteItems = remote.favorites
          .map((id) => FOOD_BY_ID.get(id))
          .filter((x): x is NonNullable<typeof x> => Boolean(x))
        const normalizedRemote = { ...remote, favoriteItems: remoteFavoriteItems }
        commit((current) => {
          const merged = mergeSnapshots(current, normalizedRemote)
          const withPending = applyPendingMutations(merged, pendingAtStart)
          return withoutDeleted(withPending, deletedIdsRef.current)
        })
      })
      .catch(() => setSyncHint('Облако недоступно, работаем локально'))
    return () => {
      cancelled = true
    }
  }, [user, commit])

  const flushPending = useCallback(async () => {
    if (!user || !supabase) return
    if (flushingRef.current) return
    flushingRef.current = true
    try {
      while (true) {
        const rows = loadPending(user.id)
        if (!rows.length) break
        const mutation = rows[0]
        await executePending(user.id, mutation)
        clearPending(user.id, mutation.key)
      }
      setSyncHint(null)
    } catch {
      setSyncHint('Не удалось сохранить в облако, данные на устройстве')
    } finally {
      flushingRef.current = false
    }
  }, [user])

  const runCloud = useCallback(
    async (mutation: PendingMutation) => {
      if (!user || !supabase) return
      queuePending(user.id, mutation)
      await flushPending()
    },
    [user, flushPending],
  )

  useEffect(() => {
    if (!user || !supabase) return
    const retry = () => {
      if (navigator.onLine && document.visibilityState === 'visible') void flushPending()
    }
    void flushPending()
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('focus', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [user, flushPending])

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
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ACTIVE_USER_KEY)
    setSnapshot(empty)
    setOverlay({ type: 'none' })
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
      commit((current) => ({
        ...current,
        profile: readyProfile,
        weightLogs: [...current.weightLogs, weight],
      }))
      await runCloud({ key: 'profile', kind: 'profile', profile: readyProfile })
      await runCloud({ key: `weight-insert:${weight.id}`, kind: 'weight-insert', entry: weight })
    },
    [commit, runCloud],
  )

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!snapshot.profile) return
      const profile = withProfileDefaults({ ...snapshot.profile, ...patch })
      commit((current) => ({ ...current, profile }))
      await runCloud({ key: 'profile', kind: 'profile', profile })
    },
    [snapshot, commit, runCloud],
  )

  const addFood = useCallback(
    async (food: FoodItem, grams: number, meal: MealType, loggedOn: string) => {
      const macros = macrosForGrams(food, grams)
      const entry: FoodEntry = {
        id: nid(),
        date: loggedOn,
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
      commit((current) => ({
        ...current,
        foodEntries: [...current.foodEntries, entry],
        recentFoods: [food, ...current.recentFoods.filter((f) => f.id !== food.id)].slice(0, 20),
      }))
      setOverlay({ type: 'none' })
      await runCloud({ key: `food-insert:${entry.id}`, kind: 'food-insert', entry })
    },
    [commit, runCloud],
  )

  const addCustomFood = useCallback(
    async (
      name: string,
      grams: number,
      per100: { kcal: number; protein: number; fat: number; carbs: number },
      meal: MealType,
      loggedOn: string,
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
      await addFood(food, grams, meal, loggedOn)
    },
    [addFood],
  )

  const removeFood = useCallback(
    async (id: string) => {
      deletedIdsRef.current.food.add(id)
      commit((current) => ({
        ...current,
        foodEntries: current.foodEntries.filter((e) => e.id !== id),
      }))
      await runCloud({ key: `food-delete:${id}`, kind: 'food-delete', id })
    },
    [commit, runCloud],
  )

  const addActivityEntry = useCallback(
    async (input: {
      activityId: string
      name: string
      minutes: number
      met: number
      note?: string
      date: string
    }) => {
      const weight = snapshot.profile?.weightKg ?? 80
      const entry: ActivityEntry = {
        id: nid(),
        date: input.date,
        activityId: input.activityId,
        name: input.name,
        minutes: input.minutes,
        met: input.met,
        kcal: activityCalories(input.met, weight, input.minutes),
        note: input.note?.trim() ?? '',
        createdAt: new Date().toISOString(),
      }
      commit((current) => ({
        ...current,
        activityEntries: [...current.activityEntries, entry],
      }))
      setOverlay({ type: 'none' })
      await runCloud({ key: `activity-insert:${entry.id}`, kind: 'activity-insert', entry })
    },
    [snapshot, commit, runCloud],
  )

  const removeActivity = useCallback(
    async (id: string) => {
      deletedIdsRef.current.activity.add(id)
      commit((current) => ({
        ...current,
        activityEntries: current.activityEntries.filter((e) => e.id !== id),
      }))
      await runCloud({ key: `activity-delete:${id}`, kind: 'activity-delete', id })
    },
    [commit, runCloud],
  )

  const addWeightLog = useCallback(
    async (weight: number, logDate: string) => {
      const entry: WeightLog = {
        id: nid(),
        date: logDate,
        weight,
        createdAt: new Date().toISOString(),
      }
      const profile = snapshot.profile
        ? { ...snapshot.profile, weightKg: weight }
        : snapshot.profile
      commit((current) => ({
        ...current,
        profile,
        weightLogs: [...current.weightLogs, entry],
      }))
      setOverlay({ type: 'none' })
      await runCloud({ key: `weight-insert:${entry.id}`, kind: 'weight-insert', entry })
      if (profile) await runCloud({ key: 'profile', kind: 'profile', profile })
    },
    [snapshot, commit, runCloud],
  )

  const removeWeight = useCallback(
    async (id: string) => {
      deletedIdsRef.current.weight.add(id)
      commit((current) => ({
        ...current,
        weightLogs: current.weightLogs.filter((e) => e.id !== id),
      }))
      await runCloud({ key: `weight-delete:${id}`, kind: 'weight-delete', id })
    },
    [commit, runCloud],
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
      commit((current) => ({ ...current, favorites, favoriteItems }))
      await runCloud({ key: `favorite:${food.id}`, kind: 'favorite', foodId: food.id, on })
    },
    [snapshot, commit, runCloud],
  )

  const copyYesterday = useCallback(async (targetDate: string) => {
    const lockKey = `copy-yesterday:${targetDate}`
    if (actionLocksRef.current.has(lockKey)) return
    actionLocksRef.current.add(lockKey)
    try {
      const yIso = shiftIso(targetDate, -1)
      const cloned = snapshot.foodEntries
        .filter((e) => e.date === yIso)
        .map((e) => ({
          ...e,
          id: nid(),
          date: targetDate,
          createdAt: new Date().toISOString(),
        }))
      if (!cloned.length) return
      commit((current) => ({ ...current, foodEntries: [...current.foodEntries, ...cloned] }))
      for (const entry of cloned) {
        await runCloud({ key: `food-insert:${entry.id}`, kind: 'food-insert', entry })
      }
    } finally {
      actionLocksRef.current.delete(lockKey)
    }
  }, [snapshot, commit, runCloud])

  const addWater = useCallback(
    async (ml: number, loggedOn: string) => {
      if (ml <= 0) return
      const entry: WaterEntry = {
        id: nid(),
        date: loggedOn,
        ml,
        createdAt: new Date().toISOString(),
      }
      commit((current) => ({ ...current, waterEntries: [...current.waterEntries, entry] }))
      setOverlay({ type: 'none' })
      await runCloud({ key: `water-insert:${entry.id}`, kind: 'water-insert', entry })
    },
    [commit, runCloud],
  )

  const removeWater = useCallback(
    async (id: string) => {
      deletedIdsRef.current.water.add(id)
      commit((current) => ({
        ...current,
        waterEntries: current.waterEntries.filter((e) => e.id !== id),
      }))
      await runCloud({ key: `water-delete:${id}`, kind: 'water-delete', id })
    },
    [commit, runCloud],
  )

  const toggleVitamin = useCallback(async (loggedOn: string) => {
    const lockKey = `vitamin:${loggedOn}`
    if (actionLocksRef.current.has(lockKey)) return
    actionLocksRef.current.add(lockKey)
    try {
      const existing = snapshot.vitaminEntries.find((v) => v.date === loggedOn)
      if (existing) {
        deletedIdsRef.current.vitamin.add(existing.id)
        commit((current) => ({
          ...current,
          vitaminEntries: current.vitaminEntries.filter((v) => v.id !== existing.id),
        }))
        await runCloud({
          key: `vitamin-delete:${existing.id}`,
          kind: 'vitamin-delete',
          id: existing.id,
        })
        return
      }
      const entry: VitaminEntry = {
        id: nid(),
        date: loggedOn,
        name: snapshot.profile?.vitaminName ?? 'Комплекс витаминов',
        createdAt: new Date().toISOString(),
      }
      commit((current) => ({
        ...current,
        vitaminEntries: [...current.vitaminEntries, entry],
      }))
      await runCloud({ key: `vitamin-insert:${entry.id}`, kind: 'vitamin-insert', entry })
    } finally {
      actionLocksRef.current.delete(lockKey)
    }
  }, [snapshot, commit, runCloud])

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
      setTab,
      setDate,
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
