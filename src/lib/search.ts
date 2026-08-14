import Fuse from 'fuse.js'
import { FOODS } from '../data/foods'
import type { FoodItem } from '../types'

const fuse = new Fuse(FOODS, {
  keys: [
    { name: 'name', weight: 0.55 },
    { name: 'aliases', weight: 0.4 },
    { name: 'category', weight: 0.05 },
  ],
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 1,
  includeScore: true,
})

export function searchLocal(query: string, limit = 24): FoodItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const starts = FOODS.filter(
    (f) =>
      f.name.toLowerCase().startsWith(q) ||
      f.aliases.some((a) => a.startsWith(q)),
  )

  const fused = fuse.search(q).map((r) => r.item)
  const seen = new Set<string>()
  const out: FoodItem[] = []
  for (const item of [...starts, ...fused]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
    if (out.length >= limit) break
  }
  return out
}
