/**
 * Barcode-Format-Validierung und -Formate für den Scan-Flow. Der Regex ist
 * deckungsgleich mit `barcodeParamsSchema` in `@repfuel/shared` (Server-Seite),
 * damit ein clientseitig abgelehnter Code erst gar nicht als Request rausgeht.
 */
export const BARCODE_REGEX = /^\d{6,14}$/;

/** Entfernt Whitespace, wie ihn manche Scanner/Tastatur-Emulationen anhängen. */
export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

export function isValidBarcode(code: string): boolean {
  return BARCODE_REGEX.test(code);
}

/**
 * Formate, nach denen `BarcodeDetector` bzw. das zxing-Fallback suchen sollen —
 * die für Lebensmittel relevanten linearen Codes (EAN-13/8, UPC-A/E).
 */
export const SUPPORTED_BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;
export type SupportedBarcodeFormat = (typeof SUPPORTED_BARCODE_FORMATS)[number];
