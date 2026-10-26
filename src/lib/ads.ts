/** Normaliza el publisher ID de AdSense para el código de anuncios.
 * Acepta `pub-...` (como lo muestra AdSense en Cuenta) o `ca-pub-...`
 * y siempre devuelve `ca-pub-...`, que es lo que exigen el script
 * `adsbygoogle.js?client=` y `data-ad-client`. Vacío → undefined
 * (placeholders, comportamiento actual). */
export function adsenseClient(raw: string | undefined): string | undefined {
  const id = raw?.trim();
  if (!id) return undefined;
  if (!/^(?:ca-)?pub-\d{16}$/.test(id)) return undefined;
  return id.startsWith('ca-') ? id : `ca-${id}`;
}

/** Verification is independent of serving. Fail closed until the published CMP
 * and its accept/reject/revoke flows have been checked on the live domain. */
export function adsenseServingEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

/** Human-readable placement names require a real numeric AdSense unit ID. */
export function adsenseSlot(name: string | undefined, rawMap: string | undefined): string | undefined {
  if (!name) return undefined;
  if (/^\d+$/.test(name)) return name;
  try {
    const value = JSON.parse(rawMap || '{}')[name];
    return typeof value === 'string' && /^\d+$/.test(value) ? value : undefined;
  } catch { return undefined; }
}
