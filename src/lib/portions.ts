import type { FoodItem } from '../types'
import { FOOD_BY_ID } from '../data/foods'

export type Portion = { label: string; grams: number }

export function entryUnit(foodId?: string): 'г' | 'мл' {
  if (!foodId) return 'г'
  const food = FOOD_BY_ID.get(foodId)
  return food ? portionUnit(food) : 'г'
}

export function portionUnit(food: FoodItem): 'г' | 'мл' {
  if (food.category === 'Напитки') return 'мл'
  if (food.id.startsWith('oil-')) return 'мл'
  return 'г'
}

export function defaultPortionGrams(food: FoodItem): number {
  return portionPresets(food)[0]?.grams ?? 100
}

export function portionPresets(food: FoodItem): Portion[] {
  if (food.category === 'Напитки') {
    return [
      { label: '200 мл', grams: 200 },
      { label: '250 мл', grams: 250 },
      { label: '350 мл', grams: 350 },
      { label: '500 мл', grams: 500 },
    ]
  }
  if (food.id.startsWith('oil-')) {
    return [
      { label: 'ч.л. 5 мл', grams: 5 },
      { label: 'ст.л. 15 мл', grams: 15 },
      { label: '30 мл', grams: 30 },
    ]
  }
  if (food.id === 'quail-egg') {
    return [
      { label: '1 шт', grams: 12 },
      { label: '5 шт', grams: 60 },
      { label: '10 шт', grams: 120 },
    ]
  }
  if (
    food.id === 'egg-chicken' ||
    food.id === 'egg-boiled' ||
    food.id === 'egg-fried' ||
    food.id === 'egg-white' ||
    food.id === 'egg-yolk'
  ) {
    const one = food.id === 'egg-white' ? 33 : food.id === 'egg-yolk' ? 17 : 55
    return [
      { label: '1 шт', grams: one },
      { label: '2 шт', grams: one * 2 },
      { label: '3 шт', grams: one * 3 },
    ]
  }
  if (food.category === 'Хлеб') {
    return [
      { label: 'ломтик 30 г', grams: 30 },
      { label: 'ломтик 40 г', grams: 40 },
      { label: '2 ломтика', grams: 60 },
    ]
  }
  if (food.id === 'honey') {
    return [
      { label: 'ч.л. 7 г', grams: 7 },
      { label: 'ст.л. 21 г', grams: 21 },
      { label: '50 г', grams: 50 },
    ]
  }
  if (food.id.startsWith('smetana')) {
    return [
      { label: 'ч.л. 10 г', grams: 10 },
      { label: 'ст.л. 25 г', grams: 25 },
      { label: '50 г', grams: 50 },
    ]
  }
  return [50, 100, 150, 200, 250].map((n) => ({ label: `${n} г`, grams: n }))
}
