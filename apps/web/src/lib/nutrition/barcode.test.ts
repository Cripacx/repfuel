import { describe, expect, it } from 'vitest';
import { isValidBarcode, normalizeBarcode } from './barcode.js';

describe('isValidBarcode', () => {
  it('accepts EAN-13 (13 digits)', () => {
    expect(isValidBarcode('4006381333931')).toBe(true);
  });

  it('accepts EAN-8 (8 digits)', () => {
    expect(isValidBarcode('40170725')).toBe(true);
  });

  it('accepts UPC-A (12 digits)', () => {
    expect(isValidBarcode('036000291452')).toBe(true);
  });

  it('accepts the minimum length (6 digits)', () => {
    expect(isValidBarcode('123456')).toBe(true);
  });

  it('accepts the maximum length (14 digits)', () => {
    expect(isValidBarcode('12345678901234')).toBe(true);
  });

  it('rejects codes shorter than 6 digits', () => {
    expect(isValidBarcode('12345')).toBe(false);
  });

  it('rejects codes longer than 14 digits', () => {
    expect(isValidBarcode('123456789012345')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidBarcode('4006381A33931')).toBe(false);
    expect(isValidBarcode('400-638-133')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidBarcode('')).toBe(false);
  });

  it('rejects untrimmed input (caller must normalize first)', () => {
    expect(isValidBarcode(' 4006381333931 ')).toBe(false);
  });
});

describe('normalizeBarcode', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeBarcode('  4006381333931  ')).toBe('4006381333931');
  });

  it('strips internal whitespace some scanners insert', () => {
    expect(normalizeBarcode('4006 3813 33931')).toBe('4006381333931');
  });

  it('is a no-op for already-clean input', () => {
    expect(normalizeBarcode('4006381333931')).toBe('4006381333931');
  });
});
