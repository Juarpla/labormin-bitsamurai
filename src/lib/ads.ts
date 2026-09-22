/** Normaliza el publisher ID de AdSense para el código de anuncios.
 * Acepta `pub-...` (como lo muestra AdSense en Cuenta) o `ca-pub-...`
 * y siempre devuelve `ca-pub-...`, que es lo que exigen el script
 * `adsbygoogle.js?client=` y `data-ad-client`. Vacío → undefined
 * (placeholders, comportamiento actual). */
export function adsenseClient(raw: string | undefined): string | undefined {
  const id = raw?.trim();
  if (!id) return undefined;
  return id.startsWith('ca-') ? id : `ca-${id}`;
}
