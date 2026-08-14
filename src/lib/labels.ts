import type { FoodForm, MealType } from '../types'

export const MEALS: { id: MealType; label: string; emoji: string }[] = [
  { id: 'breakfast', label: 'Завтрак', emoji: '☀️' },
  { id: 'lunch', label: 'Обед', emoji: '🍽️' },
  { id: 'dinner', label: 'Ужин', emoji: '🌙' },
  { id: 'snack', label: 'Перекус', emoji: '🍎' },
]

export function mealLabel(id: MealType): string {
  return MEALS.find((m) => m.id === id)?.label ?? id
}

export function formLabel(form: FoodForm): string {
  if (form === 'dry') return 'Сухой'
  if (form === 'cooked') return 'Варёный'
  return 'Как есть'
}

export function formHint(form: FoodForm): string {
  if (form === 'dry') return 'Вес сухого продукта до варки'
  if (form === 'cooked') return 'Вес уже приготовленного продукта'
  return 'Вес как на упаковке или на тарелке'
}
