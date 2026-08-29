/**
 * Verzögert Aufrufe von `fn`, bis `delayMs` seit dem letzten Aufruf vergangen sind — für
 * Suchfelder gegen `GET /exercises?q=`, damit nicht bei jedem Tastendruck ein Request rausgeht.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): { (...args: Args): void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Args): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delayMs);
  };

  debounced.cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return debounced;
}
