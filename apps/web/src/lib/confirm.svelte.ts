/**
 * Bestätigungsdialog für zerstörerische Aktionen.
 *
 * Ersetzt das native `confirm()`: das blockiert den Thread, ignoriert die
 * Gestaltung der App und sieht auf jeder Plattform anders aus. Die
 * versprochene API bleibt aber dieselbe Form (`if (!(await requestConfirm(…)))
 * return;`), damit die Aufrufstellen lesbar bleiben.
 *
 * Genau eine Anfrage kann offen sein — zwei gleichzeitige Bestätigungen wären
 * ohnehin nicht bedienbar. Eine zweite Anfrage lehnt die vorige ab, statt sie
 * stillschweigend zu verwerfen.
 */
export interface ConfirmRequest {
  message: string;
  /** Beschriftung der bestätigenden Aktion; Default: „Löschen“ aus der i18n. */
  confirmLabel?: string;
  title?: string;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

let pending = $state<PendingConfirm | null>(null);

export function getPendingConfirm(): PendingConfirm | null {
  return pending;
}

export function requestConfirm(request: ConfirmRequest): Promise<boolean> {
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { ...request, resolve };
  });
}

export function resolveConfirm(confirmed: boolean): void {
  const current = pending;
  pending = null;
  current?.resolve(confirmed);
}
