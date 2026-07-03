/**
 * Transport for shareable settings. The query string is the canonical preset
 * format; this module owns how it is read from and published to the
 * environment (the browser URL today — a desktop build would swap this for
 * preset files or web-app-prefixed links). No other module touches
 * `window.location` / `history` for settings.
 */

/** The current settings query (`?a=1&b=2` or empty when none/SSR). */
export const readSettingsQuery = (): string =>
  typeof window === 'undefined' ? '' : window.location.search;

/**
 * Publish the settings query to the environment (reflect it in the address
 * bar) and return the full shareable string.
 */
export const publishSettings = (query: string): string => {
  const url = `${window.location.origin}${window.location.pathname}?${query}`;
  window.history.replaceState(null, '', url);
  return url;
};
