/**
 * Rekursiver Typ für verschachtelte Message-Dictionaries. `de.ts` nutzt ihn über
 * `satisfies MessageTree`, damit sowohl einzelne Strings als auch beliebig tief
 * verschachtelte Gruppen (z. B. `auth.loginTitle`) zulässig sind, ohne auf `any`
 * zurückzugreifen.
 */
export type MessageTree = {
  readonly [key: string]: string | MessageTree;
};

/**
 * `de.ts` wird mit `as const` deklariert, damit TypeScript die exakte
 * Schlüssel-Struktur ableiten kann. Damit wären Blattwerte allerdings String-
 * *Literale* (z. B. `"Lädt…"`) statt `string` — jede andere Sprache müsste dann
 * wortgleich mit dem Deutschen sein. `Widen` ersetzt jeden String-Literal-Typ
 * durch `string` und erhält dabei die verschachtelte Objektstruktur, sodass
 * `en.ts` dieselben Keys mit beliebigem englischem Text liefern muss.
 */
export type Widen<T> = {
  [K in keyof T]: T[K] extends string ? string : Widen<T[K]>;
};
