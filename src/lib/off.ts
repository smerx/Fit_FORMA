import type { FoodItem } from '../types'

type OffProduct = {
  code?: string
  product_name?: string
  product_name_ru?: string
  generic_name?: string
  image_small_url?: string
  image_url?: string
  nutriments?: Record<string, number | undefined>
}

type OffSearch = {
  products?: OffProduct[]
}

function formFromName(name: string): FoodItem['form'] {
  const n = name.toLowerCase()
  if (/варён|варен|готов|cooked|boiled/.test(n)) return 'cooked'
  if (/сух|dry|сырая крупа|сырой рис/.test(n)) return 'dry'
  return 'as_is'
}

function kcalOf(n: Record<string, number | undefined> | undefined): number | null {
  if (!n) return null
  const kcal = n['energy-kcal_100g'] ?? n.energy_kcal_100g
  if (typeof kcal === 'number' && kcal > 0) return Math.round(kcal)
  const kj = n['energy-kj_100g'] ?? n.energy_kj_100g
  if (typeof kj === 'number' && kj > 0) return Math.round(kj / 4.184)
  return null
}

function mapOffProduct(p: OffProduct): FoodItem | null {
  const name = (p.product_name_ru || p.product_name || p.generic_name || '').trim()
  const kcal = kcalOf(p.nutriments)
  if (!name || kcal == null) return null
  const n = p.nutriments ?? {}
  return {
    id: `off-${p.code || name}`,
    name,
    aliases: [name.toLowerCase()],
    category: 'Магазин',
    form: formFromName(name),
    kcal,
    protein: Number(n.proteins_100g ?? 0),
    fat: Number(n.fat_100g ?? 0),
    carbs: Number(n.carbohydrates_100g ?? 0),
    emoji: '🛒',
    image: p.image_small_url || p.image_url,
  }
}

export async function searchOpenFoodFacts(query: string): Promise<FoodItem[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '12',
    lc: 'ru',
    cc: 'ru',
    fields:
      'code,product_name,product_name_ru,generic_name,image_small_url,image_url,nutriments',
  })

  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = (await res.json()) as OffSearch
  const out: FoodItem[] = []
  for (const p of data.products ?? []) {
    const item = mapOffProduct(p)
    if (item) out.push(item)
  }
  return out
}

export async function lookupBarcode(code: string): Promise<FoodItem | null> {
  const clean = code.replace(/\D/g, '')
  if (clean.length < 8) return null
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=code,product_name,product_name_ru,generic_name,image_small_url,image_url,nutriments`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const data = (await res.json()) as { status?: number; product?: OffProduct }
  if (data.status !== 1 || !data.product) return null
  return mapOffProduct({ ...data.product, code: data.product.code || clean })
}
