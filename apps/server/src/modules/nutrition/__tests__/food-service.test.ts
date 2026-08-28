import { describe, expect, it } from 'vitest';
import { createFoodService } from '../services/food-service.js';
import { fakeFoodRepo, fakeOffClient, makeFood } from './fakes.js';

const USER = '00000000-0000-4000-8000-000000000001';

describe('food service', () => {
  it('returns local foods first, then cached OFF results', async () => {
    const local = makeFood({ name: 'Oats Custom', userId: USER });
    const foodRepo = fakeFoodRepo([local]);
    const service = createFoodService({
      foodRepo,
      offClient: fakeOffClient([
        {
          barcode: '123',
          name: 'Oats External',
          brand: 'Brandy',
          kcalPer100: 370,
          proteinPer100: 13,
          carbsPer100: 60,
          fatPer100: 6,
        },
      ]),
    });
    const results = await service.search(USER, 'oats', 20);
    expect(results[0]?.name).toBe('Oats Custom');
    expect(results[1]?.name).toBe('Oats External');
    expect(results[1]?.source).toBe('off');
    // OFF-Treffer wurde in foods gecacht
    expect(foodRepo.rows.some((r) => r.offBarcode === '123')).toBe(true);
    // Zweite Suche dedupliziert (Cache liefert lokal, OFF wird nicht doppelt angelegt)
    const again = await service.search(USER, 'oats', 20);
    expect(again.filter((f) => f.offBarcode === '123')).toHaveLength(1);
  });

  it('resolves barcodes from cache first, then OFF (404 wenn unbekannt)', async () => {
    const foodRepo = fakeFoodRepo();
    const service = createFoodService({
      foodRepo,
      offClient: fakeOffClient([
        {
          barcode: '4099200179193',
          name: 'Skyr',
          brand: null,
          kcalPer100: 63,
          proteinPer100: 11,
          carbsPer100: 4,
          fatPer100: 0.2,
        },
      ]),
    });
    const food = await service.byBarcode('4099200179193');
    expect(food.name).toBe('Skyr');
    expect(foodRepo.rows).toHaveLength(1);
    const cached = await service.byBarcode('4099200179193');
    expect(cached.id).toBe(food.id);
    await expect(service.byBarcode('000000')).rejects.toMatchObject({ code: 'not_found' });
  });
});
