import type { KeyValueStore } from '../../../core/redis.js';

/** Normalisiertes Open-Food-Facts-Produkt (nur was repfuel braucht). */
export interface OffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
}

export interface OffClient {
  search(query: string, limit: number): Promise<OffProduct[]>;
  byBarcode(code: string): Promise<OffProduct | null>;
}

const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const USER_AGENT = 'repfuel/0.1 (self-hosted; +https://github.com/cripacx/repfuel)';
const SEARCH_CACHE_TTL = 60 * 60; // 1h
const PRODUCT_CACHE_TTL = 24 * 60 * 60; // 24h
const FETCH_TIMEOUT_MS = 10_000;

interface RawNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface RawProduct {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  nutriments?: RawNutriments;
}

function normalize(raw: RawProduct): OffProduct | null {
  const n = raw.nutriments ?? {};
  const kcal = n['energy-kcal_100g'];
  if (!raw.code || !raw.product_name || typeof kcal !== 'number') return null;
  const brand = Array.isArray(raw.brands) ? raw.brands[0] : raw.brands?.split(',')[0]?.trim();
  return {
    barcode: raw.code,
    name: raw.product_name,
    brand: brand || null,
    kcalPer100: kcal,
    proteinPer100: typeof n.proteins_100g === 'number' ? n.proteins_100g : 0,
    carbsPer100: typeof n.carbohydrates_100g === 'number' ? n.carbohydrates_100g : 0,
    fatPer100: typeof n.fat_100g === 'number' ? n.fat_100g : 0,
  };
}

export interface OffClientDeps {
  cache: KeyValueStore;
  fetchFn?: typeof fetch;
  onError?: (err: unknown, context: string) => void;
}

export function createOffClient(deps: OffClientDeps): OffClient {
  const fetchFn = deps.fetchFn ?? fetch;

  async function fetchJson(url: string): Promise<unknown | null> {
    try {
      const res = await fetchFn(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch (err) {
      deps.onError?.(err, url);
      return null;
    }
  }

  return {
    async search(query, limit) {
      const cacheKey = `off:search:${limit}:${query.toLowerCase()}`;
      const cached = await deps.cache.get(cacheKey);
      if (cached) return JSON.parse(cached) as OffProduct[];
      const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&page_size=${limit}&fields=code,product_name,brands,nutriments`;
      const json = (await fetchJson(url)) as { hits?: RawProduct[] } | null;
      const products = (json?.hits ?? [])
        .map(normalize)
        .filter((p): p is OffProduct => p !== null);
      await deps.cache.setWithTtl(cacheKey, JSON.stringify(products), SEARCH_CACHE_TTL);
      return products;
    },

    async byBarcode(code) {
      const cacheKey = `off:product:${code}`;
      const cached = await deps.cache.get(cacheKey);
      if (cached) return JSON.parse(cached) as OffProduct | null;
      const url = `${PRODUCT_URL}/${encodeURIComponent(code)}.json?fields=code,product_name,brands,nutriments`;
      const json = (await fetchJson(url)) as { product?: RawProduct } | null;
      const product = json?.product ? normalize(json.product) : null;
      await deps.cache.setWithTtl(cacheKey, JSON.stringify(product), PRODUCT_CACHE_TTL);
      return product;
    },
  };
}
