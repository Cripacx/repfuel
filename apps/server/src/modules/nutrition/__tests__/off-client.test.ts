import { describe, expect, it, vi } from 'vitest';
import { createOffClient } from '../services/off-client.js';
import { fakeKv } from '../../../core/testing/fake-kv.js';

const searchPayload = {
  hits: [
    {
      code: '20003166',
      product_name: 'Haferflocken',
      brands: 'Crownfield',
      nutriments: {
        'energy-kcal_100g': 372,
        proteins_100g: 13.5,
        carbohydrates_100g: 58.7,
        fat_100g: 7,
      },
    },
    // Ohne kcal → wird verworfen
    { code: '999', product_name: 'No Nutrition', nutriments: {} },
  ],
};

function fetchOk(payload: unknown) {
  return vi.fn(async () => ({ ok: true, json: async () => payload })) as unknown as typeof fetch;
}

describe('off client', () => {
  it('normalizes products and drops entries without kcal', async () => {
    const client = createOffClient({ cache: fakeKv(), fetchFn: fetchOk(searchPayload) });
    const results = await client.search('hafer', 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      barcode: '20003166',
      name: 'Haferflocken',
      brand: 'Crownfield',
      kcalPer100: 372,
    });
  });

  it('caches search results in the kv store', async () => {
    const kv = fakeKv();
    const fetchFn = fetchOk(searchPayload);
    const client = createOffClient({ cache: kv, fetchFn });
    await client.search('hafer', 10);
    await client.search('hafer', 10);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns empty results when OFF is unreachable', async () => {
    const onError = vi.fn();
    const client = createOffClient({
      cache: fakeKv(),
      fetchFn: vi.fn(async () => {
        throw new Error('ENETUNREACH');
      }) as unknown as typeof fetch,
      onError,
    });
    expect(await client.search('hafer', 10)).toEqual([]);
    expect(await client.byBarcode('123456')).toBeNull();
    expect(onError).toHaveBeenCalled();
  });
});
