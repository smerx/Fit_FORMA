const KEY = 'forma-food-misses-v1'

export type FoodSearchMiss = {
  query: string
  count: number
  lastAt: string
}

export function rememberFoodSearchMiss(query: string) {
  const clean = query.trim().replace(/\s+/g, ' ')
  if (clean.length < 2) return
  try {
    const rows = readFoodSearchMisses()
    const found = rows.find((row) => row.query.toLocaleLowerCase('ru') === clean.toLocaleLowerCase('ru'))
    if (found) {
      found.count += 1
      found.lastAt = new Date().toISOString()
    } else {
      rows.push({ query: clean, count: 1, lastAt: new Date().toISOString() })
    }
    localStorage.setItem(
      KEY,
      JSON.stringify(rows.sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, 100)),
    )
  } catch {
    /* журнал поиска не должен мешать добавлению еды */
  }
}

export function readFoodSearchMisses(): FoodSearchMiss[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const rows = JSON.parse(raw) as FoodSearchMiss[]
    return rows.filter((row) => row.query && row.count > 0 && row.lastAt)
  } catch {
    return []
  }
}
