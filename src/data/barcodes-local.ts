import type { FoodItem } from '../types'

type Macro = {
  name: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  emoji?: string
}

/**
 * Реальные коды из Open Food Facts + типичная молочка РФ.
 * Локальные (Ангара и т.п.) почти не в OFF — после первого «Свой продукт»
 * код запоминается на телефоне (forma-barcodes-v1).
 */
const LOCAL: Record<string, Macro> = {
  // Ангара (Усть-Илимск) — единственный код с КБЖУ в OFF на момент сборки
  '4650055741470': { name: 'Молоко Ангара пастеризованное 2,5%', kcal: 53, protein: 3, fat: 2.5, carbs: 4.7, emoji: '🥛' },

  // Простоквашино
  '4607053473544': { name: 'Молоко Простоквашино 2,5%', kcal: 52, protein: 2.9, fat: 2.5, carbs: 4.9, emoji: '🥛' },
  '4607053473537': { name: 'Молоко Простоквашино отборное', kcal: 63, protein: 3.2, fat: 3.5, carbs: 4.7, emoji: '🥛' },
  '4600605029282': { name: 'Сметана Простоквашино 10%', kcal: 117, protein: 2.8, fat: 10, carbs: 3.9, emoji: '🥛' },
  '4600605029275': { name: 'Сметана Простоквашино 15%', kcal: 160, protein: 2.7, fat: 15, carbs: 3.6, emoji: '🥛' },
  '4600605029343': { name: 'Творог Простоквашино 2%', kcal: 99, protein: 17, fat: 2, carbs: 3.3, emoji: '🧀' },
  '4600605033951': { name: 'Йогурт греческий Простоквашино', kcal: 64, protein: 8.7, fat: 2, carbs: 2.8, emoji: '🥛' },
  '4600605033906': { name: 'Йогурт густой греческий Простоквашино', kcal: 64, protein: 8.7, fat: 2, carbs: 2.8, emoji: '🥛' },

  // Домик в деревне
  '4690228010323': { name: 'Молоко Домик в деревне 2,5%', kcal: 53, protein: 3, fat: 2.5, carbs: 4.7, emoji: '🥛' },
  '4690228007842': { name: 'Молоко Домик в деревне 2,5%', kcal: 53, protein: 3, fat: 2.5, carbs: 4.7, emoji: '🥛' },
  '4690228004018': { name: 'Молоко Домик в деревне 3,2%', kcal: 60, protein: 3, fat: 3.2, carbs: 4.7, emoji: '🥛' },
  '4690228109713': { name: 'Молоко Домик в деревне 3,2%', kcal: 60, protein: 3, fat: 3.2, carbs: 4.7, emoji: '🥛' },
  '4690228034183': { name: 'Сметана Домик в деревне 15%', kcal: 160, protein: 2.6, fat: 15, carbs: 3.6, emoji: '🥛' },
  '4607096004477': { name: 'Сливки Домик в деревне 20%', kcal: 205, protein: 2.5, fat: 20, carbs: 3.7, emoji: '🥛' },

  // Частые РФ (офлайн-подстраховка)
  '4607025392477': { name: 'Кефир 1%', kcal: 37, protein: 3, fat: 1, carbs: 4, emoji: '🥛' },
  '4607004890086': { name: 'Яйцо куриное С1', kcal: 157, protein: 12.7, fat: 11.5, carbs: 0.7, emoji: '🥚' },
}

function toFood(idPrefix: string, code: string, row: Macro): FoodItem {
  return {
    id: `${idPrefix}-${code}`,
    name: row.name,
    aliases: [row.name.toLowerCase(), 'ангара', 'ангария', 'иркутск', 'россия'],
    category: 'Магазин',
    form: 'as_is',
    kcal: row.kcal,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    emoji: row.emoji ?? '🛒',
  }
}

export function barcodeVariants(code: string): string[] {
  const clean = code.replace(/\D/g, '')
  if (!clean) return []
  const set = new Set<string>([clean])
  if (clean.length === 12) set.add(`0${clean}`)
  if (clean.length === 13 && clean.startsWith('0')) set.add(clean.slice(1))
  if (clean.length === 14 && clean.startsWith('0')) set.add(clean.slice(1))
  // GTIN-14 → EAN-13
  if (clean.length === 14) set.add(clean.slice(1))
  return [...set]
}

export function lookupLocalBarcode(code: string): FoodItem | null {
  for (const v of barcodeVariants(code)) {
    const row = LOCAL[v]
    if (row) return toFood('local', v, row)
  }
  return null
}

const STORAGE_KEY = 'forma-barcodes-v1'

export function rememberLocalBarcode(code: string, food: Macro) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, Macro>) : {}
    for (const v of barcodeVariants(code)) {
      map[v] = food
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* квота */
  }
}

export function lookupRememberedBarcode(code: string): FoodItem | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, Macro>
    for (const v of barcodeVariants(code)) {
      const row = map[v]
      if (row) return toFood('saved', v, row)
    }
    return null
  } catch {
    return null
  }
}
