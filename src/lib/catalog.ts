import { env } from 'cloudflare:workers';
import { generatedAt } from './jobs';
import { snapshotRows, type CatalogEntry, type CatalogKind, type CatalogRow, type JobMeta } from './catalog-data';

// This server-side module owns all access to the Worker binding.
type Statement = {
  bind(...values: string[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
};
type Database = { prepare(sql: string): Statement };
type StoredRow = { slug: string; metadata: string; payload: string };
const db = (env as { CATALOG_DB?: Database }).CATALOG_DB;

async function databaseFor(kind: CatalogKind) {
  if (!db) return;
  try {
    const ready = await db.prepare('SELECT source_revision FROM catalog_ready WHERE name = ?')
      .bind(kind).first<{ source_revision: string | null }>();
    if (ready && (kind !== 'jobs' || (ready.source_revision ?? '') >= generatedAt)) return db;
  } catch (error) {
    if (!String(error).includes('no such table: catalog_ready')) console.error('No se pudo abrir el catálogo D1', kind, error);
  }
}

function unpack<K extends CatalogKind>(row: StoredRow): CatalogRow<K> {
  return { slug: row.slug, metadata: JSON.parse(row.metadata), payload: JSON.parse(row.payload) };
}

export async function catalogRecord<K extends CatalogKind>(kind: K, slug: string) {
  const database = await databaseFor(kind);
  if (database) {
    const row = await database.prepare(`SELECT slug, metadata, payload FROM catalog_${kind} WHERE slug = ?`)
      .bind(slug).first<StoredRow>();
    return row ? unpack<K>(row) : undefined;
  }
  return (await snapshotRows(kind)).find(row => row.slug === slug);
}

export async function openCatalog<K extends CatalogKind>(kind: K, jobType?: JobMeta['type']) {
  const database = await databaseFor(kind);
  const scope = kind === 'jobs' && jobType;
  if (database) {
    const selection = database.prepare(`SELECT slug, metadata FROM catalog_${kind}${scope ? " WHERE json_extract(metadata, '$.type') = ?" : ''} ORDER BY position, slug`);
    const { results } = await (scope ? selection.bind(scope) : selection).all<Pick<StoredRow, 'slug' | 'metadata'>>();
    const entries = results.map(row => ({ slug: row.slug, metadata: JSON.parse(row.metadata) })) as CatalogEntry<K>[];
    return {
      entries,
      async read(slugs: readonly string[]) {
        if (!slugs.length) return [];
        const rows = await Promise.all(Array.from({ length: Math.ceil(slugs.length / 80) }, (_, i) => {
          const chunk = slugs.slice(i * 80, i * 80 + 80);
          return database.prepare(`SELECT slug, payload FROM catalog_${kind} WHERE slug IN (${chunk.map(() => '?').join(',')})`)
            .bind(...chunk).all<Pick<StoredRow, 'slug' | 'payload'>>();
        }));
        const payloads = new Map(rows.flatMap(row => row.results).map(row => [row.slug, JSON.parse(row.payload) as CatalogRow<K>['payload']]));
        return slugs.flatMap(slug => payloads.has(slug) ? [payloads.get(slug)!] : []);
      },
    };
  }
  const fallback = (await snapshotRows(kind)).filter(row => !scope || (row.metadata as JobMeta).type === scope);
  const payloads = new Map(fallback.map(row => [row.slug, row.payload]));
  const entries = fallback.map(({ slug, metadata }) => ({ slug, metadata }));
  return {
    entries,
    async read(slugs: readonly string[]) {
      return slugs.flatMap(slug => payloads.has(slug) ? [payloads.get(slug)!] : []);
    },
  };
}
