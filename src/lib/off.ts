import type { FoodItem } from '../types'
import {
  barcodeVariants,
  lookupLocalBarcode,
  lookupRememberedBarcode,
  rememberLocalBarcode,
} from '../data/barcodes-local'

type OffProduct = {
  code?: string
  product_name?: string
  product_name_ru?: string
  product_name_en?: string
  generic_name?: string
  brands?: string
  image_small_url?: string
  image_url?: string
  nutriments?: Record<string, number | undefined>
}

type OffSearch = {
  products?: OffProduct[]
}

const UA = 'FormaPWA/1.0 (fit-forma; personal diary)'

const FIELDS =
  'code,product_name,product_name_ru,product_name_en,generic_name,brands,image_small_url,image_url,nutriments'

function formFromName(name: string): FoodItem['form'] {
  const n = name.toLowerCase()
  if (/варён|варен|готов|cooked|boiled/.test(n)) return 'cooked'
  if (/сух|dry|сырая крупа|сырой рис/.test(n)) return 'dry'
  return 'as_is'
}

function kcalOf(n: Record<string, number | undefined> | undefined): number | null {
  if (!n) return null
  const kcal = n['energy-kcal_100g'] ?? n.energy_kcal_100g ?? n['energy-kcal']
  if (typeof kcal === 'number' && kcal > 0) return Math.round(kcal)
  const kj = n['energy-kj_100g'] ?? n.energy_kj_100g ?? n['energy-kj']
  if (typeof kj === 'number' && kj > 0) return Math.round(kj / 4.184)
  const p = Number(n.proteins_100g ?? 0)
  const f = Number(n.fat_100g ?? 0)
  const c = Number(n.carbohydrates_100g ?? 0)
  if (p + f + c > 0) return Math.round(4 * p + 9 * f + 4 * c)
  return null
}

function mapOffProduct(p: OffProduct, codeFallback?: string): FoodItem | null {
  const baseName = (p.product_name_ru || p.product_name || p.product_name_en || p.generic_name || '').trim()
  const brand = (p.brands || '').split(',')[0]?.trim()
  const name =
    brand && baseName && !baseName.toLowerCase().includes(brand.toLowerCase())
      ? `${baseName} (${brand})`
      : baseName
  const kcal = kcalOf(p.nutriments)
  if (!name || kcal == null) return null
  const n = p.nutriments ?? {}
  const code = p.code || codeFallback || name
  return {
    id: `off-${code}`,
    name,
    aliases: [name.toLowerCase(), brand?.toLowerCase() ?? ''].filter(Boolean),
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

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
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
    page_size: '16',
    lc: 'ru',
    cc: 'ru',
    fields: FIELDS,
  })

  const hosts = ['https://ru.openfoodfacts.org', 'https://world.openfoodfacts.org']
  const seen = new Set<string>()
  const out: FoodItem[] = []

  for (const host of hosts) {
    const data = (await fetchJson(`${host}/cgi/search.pl?${params.toString()}`)) as OffSearch | null
    for (const p of data?.products ?? []) {
      const item = mapOffProduct(p)
      if (!item || seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
    if (out.length >= 12) break
  }
  return out.slice(0, 16)
}

async function fetchOffProduct(host: string, clean: string): Promise<FoodItem | null> {
  const data = (await fetchJson(
    `${host}/api/v2/product/${clean}.json?fields=${FIELDS}`,
  )) as { status?: number; product?: OffProduct } | null
  if (data?.status === 1 && data.product) {
    return mapOffProduct({ ...data.product, code: data.product.code || clean }, clean)
  }
  const legacy = (await fetchJson(`${host}/api/v0/product/${clean}.json`)) as {
    status?: number
    product?: OffProduct
  } | null
  if (legacy?.status === 1 && legacy.product) {
    return mapOffProduct({ ...legacy.product, code: legacy.product.code || clean }, clean)
  }
  return null
}

/** Из QR / Data Matrix / сырой строки достаём GTIN/EAN. */
export function extractBarcodePayload(raw: string): string {
  const trimmed = raw.trim()
  const onlyDigits = trimmed.replace(/\D/g, '')
  if (/^\d{8,14}$/.test(onlyDigits) && onlyDigits.length === trimmed.replace(/\s/g, '').length) {
    return onlyDigits
  }
  try {
    const u = new URL(trimmed)
    for (const key of ['ean', 'gtin', 'barcode', 'code', 'id']) {
      const v = u.searchParams.get(key)
      if (v && /\d{8,14}/.test(v)) return v.replace(/\D/g, '')
    }
    const last = u.pathname.split('/').filter(Boolean).pop() ?? ''
    const d = last.replace(/\D/g, '')
    if (d.length >= 8 && d.length <= 14) return d
  } catch {
    /* не URL */
  }
  const m = trimmed.match(/(?:gtin|ean|barcode)[=:\s]?(\d{8,14})/i)
  if (m?.[1]) return m[1]
  if (onlyDigits.length >= 8 && onlyDigits.length <= 14) return onlyDigits
  return trimmed
}

export async function lookupBarcode(code: string): Promise<FoodItem | null> {
  const extracted = extractBarcodePayload(code)
  const clean = extracted.replace(/\D/g, '')
  if (clean.length < 8) return null

  const local = lookupLocalBarcode(clean) ?? lookupRememberedBarcode(clean)
  if (local) return local

  const hosts = ['https://ru.openfoodfacts.org', 'https://world.openfoodfacts.org']
  for (const variant of barcodeVariants(clean)) {
    for (const host of hosts) {
      const item = await fetchOffProduct(host, variant)
      if (item) {
        rememberLocalBarcode(variant, {
          name: item.name,
          kcal: item.kcal,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbs,
        })
        return item
      }
    }
  }
  return null
}
