import { env } from 'cloudflare:workers';
import { generatedAt } from './jobs';
import feed from '../data/jobs.json';
import { isExpired, jobExpiration } from './job-policy.mjs';
import { cachedCatalogSelection } from './catalog-cache.mjs';
import { isActiveJobRow, jobRecommendations, snapshotJob, snapshotJobRecord, snapshotRows, type CatalogEntry, type CatalogKind, type CatalogRow, type JobMeta, type JobRecord } from './catalog-data';
import type { Job } from '../schemas';

// This server-side module owns all access to the Worker binding.
type Statement = {
  bind(...values: string[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[]; meta: { rows_read: number } }>;
};
type Database = { prepare(sql: string): Statement };
type StoredRow = { slug: string; metadata: string; payload: string };
const db = (env as { CATALOG_DB?: Database }).CATALOG_DB;
// The original center rows already store these fields in their payloads. Read
// only the fields the directory needs, including for rows imported before 0002.
const centerMetadata = `json_patch(metadata, json_object(
  'name', json_extract(payload, '$.name'), 'location', json_extract(payload, '$.location'),
  'costLabel', json_extract(payload, '$.costLabel')
)) AS metadata`;
const snapshotExpirations = new Map<string, string | undefined>();
let snapshotFeed: Map<string, typeof feed.jobs[number]> | undefined;

function currentJobMetadata(slug: string, metadata: JobMeta): JobMeta {
  if (!snapshotExpirations.has(slug)) {
    snapshotFeed ??= new Map(feed.jobs.map(job => [job.slug, job]));
    const job = snapshotFeed.get(slug);
    snapshotExpirations.set(slug, job && jobExpiration(job)?.date);
  }
  const closesAt = snapshotExpirations.get(slug);
  return closesAt && (!metadata.closesAt || closesAt < metadata.closesAt) ? { ...metadata, closesAt } : metadata;
}

async function databaseFor(kind: CatalogKind) {
  if (!db) return;
  try {
    const { results: [ready], meta } = await db.prepare('SELECT source_revision FROM catalog_ready WHERE name = ?')
      .bind(kind).all<{ source_revision: string | null }>();
    if (ready && (kind !== 'jobs' || (ready.source_revision ?? '') >= generatedAt)) {
      return { database: db, revision: ready.source_revision, rowsRead: meta.rows_read };
    }
  } catch (error) {
    if (!String(error).includes('no such table: catalog_ready')) console.error('No se pudo abrir el catálogo D1', kind, error);
  }
}

function unpack<K extends CatalogKind>(row: StoredRow): CatalogRow<K> {
  return { slug: row.slug, metadata: JSON.parse(row.metadata), payload: JSON.parse(row.payload) };
}

async function tryDatabaseRead<T>(kind: CatalogKind, read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    console.error('No se pudo leer el catálogo D1', kind, error);
  }
}

function selectPayloads<K extends CatalogKind>(
  rows: Map<string, CatalogRow<K>['payload']>, slugs: readonly string[],
) {
  return slugs.flatMap(slug => rows.has(slug) ? [rows.get(slug)!] : []);
}

export async function catalogRecord<K extends CatalogKind>(kind: K, slug: string) {
  const source = await databaseFor(kind);
  if (source) {
    const record = await tryDatabaseRead(kind, async () => {
      const row = await source.database.prepare(`SELECT slug, metadata, payload FROM catalog_${kind} WHERE slug = ?`)
        .bind(slug).first<StoredRow>();
      return row ? unpack<K>(row) : null;
    });
    if (record !== undefined) return record ?? undefined;
  }
  return (await snapshotRows(kind)).find(row => row.slug === slug);
}

export async function openJobDetail(slug: string, now: Date) {
  const source = await databaseFor('jobs');
  const stored = source && await tryDatabaseRead('jobs', async () => {
    const { results: [row], meta } = await source.database
      .prepare('SELECT slug, metadata, payload FROM catalog_jobs WHERE slug = ?').bind(slug).all<StoredRow>();
    return { entry: row ? unpack<'jobs'>(row) : undefined, rowsRead: meta.rows_read };
  });
  const entry = stored ? stored.entry : snapshotJobRecord(slug);
  const at = now.toISOString();
  const metadata = entry && source?.revision === generatedAt ? currentJobMetadata(slug, entry.metadata) : entry?.metadata;
  const job = entry?.payload.job;
  if (!entry || !job || !metadata || !isActiveJobRow(metadata, at) || isExpired(job, now)) return;

  const plan = entry.payload.recommendations ?? (source?.revision === generatedAt ? jobRecommendations[slug] : undefined);
  const current = (match: { closesAt: string | null }) => !match.closesAt || match.closesAt > at;
  const guidance = (plan?.guidance ?? []).filter(current).map(match => match.slug);
  const related = (plan?.related ?? []).filter(current).slice(0, 3).map(match => match.slug);
  const slugs = [...new Set([...guidance, ...related])];
  const loaded = source && stored && slugs.length ? await tryDatabaseRead('jobs', () => source.database.prepare(
    `SELECT slug, metadata, payload FROM catalog_jobs WHERE slug IN (${slugs.map(() => '?').join(',')})
      AND json_extract(metadata, '$.type') IN ('job', 'internship')
      AND (json_extract(metadata, '$.closesAt') IS NULL OR json_extract(metadata, '$.closesAt') > ?)`,
  ).bind(...slugs, at).all<StoredRow>()) : undefined;
  const matches = new Map<string, Job>();
  if (loaded) {
    for (const row of loaded.results) {
      const match = (JSON.parse(row.payload) as JobRecord).job;
      const live = source?.revision === generatedAt ? currentJobMetadata(row.slug, JSON.parse(row.metadata)) : undefined;
      if (match && (!live || isActiveJobRow(live, at)) && !isExpired(match, now)) matches.set(row.slug, match);
    }
  } else {
    for (const slug of slugs) {
      const match = snapshotJob(slug);
      if (match && !isExpired(match, now)) matches.set(slug, match);
    }
  }
  return {
    job,
    clearView: entry.payload.clearView,
    uniqueExcerpt: plan?.uniqueExcerpt ?? false,
    guidance: guidance.flatMap(slug => matches.get(slug) ?? []),
    related: related.flatMap(slug => matches.get(slug) ?? []),
    rowsRead: source && stored && (!slugs.length || loaded)
      ? source.rowsRead + stored.rowsRead + (loaded?.meta.rows_read ?? 0) : undefined,
  };
}

export function openCatalog<K extends CatalogKind>(kind: K, jobType?: JobMeta['type'], activeAt?: string) {
  return readCatalog(kind, { jobType, activeAt });
}

export function openTrainingPrograms(options: { center?: string; indexable?: boolean } = {}) {
  return readCatalog('programs', options);
}

async function readCatalog<K extends CatalogKind>(kind: K, { jobType, activeAt, center, indexable }: {
  jobType?: JobMeta['type']; activeAt?: string; center?: string; indexable?: boolean;
}) {
  const source = await databaseFor(kind);
  const scope = kind === 'jobs' && jobType;
  const loadSnapshot = async () => (await snapshotRows(kind)).filter(row =>
    (!scope || (row.metadata as JobMeta).type === scope) &&
    (!activeAt || kind !== 'jobs' || isActiveJobRow(row.metadata as JobMeta, activeAt)) &&
    (!center || row.slug.startsWith(`${center}/`)) &&
    (!indexable || ('indexable' in row.metadata && row.metadata.indexable))
  );
  if (source) {
    const { database, revision } = source;
    const clauses: string[] = [];
    const params: string[] = [];
    if (scope) {
      clauses.push("json_extract(metadata, '$.type') = ?");
      params.push(scope);
    }
    if (kind === 'jobs' && activeAt) {
      clauses.push("json_extract(metadata, '$.type') IN ('job', 'internship')");
    }
    if (center) {
      clauses.push('center_slug = ?');
      params.push(center);
    }
    if (indexable) clauses.push("json_extract(metadata, '$.indexable') = 1");
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const fields = kind === 'training' ? centerMetadata : 'metadata';
    const results = await tryDatabaseRead<Pick<StoredRow, 'slug' | 'metadata'>[]>(kind, () => cachedCatalogSelection(
      [kind, revision, scope || null, Boolean(activeAt), center ?? null, Boolean(indexable)],
      async () => {
        const selection = database.prepare(`SELECT slug, ${fields} FROM catalog_${kind}${where} ORDER BY position, slug`);
        return (await (params.length ? selection.bind(...params) : selection).all<Pick<StoredRow, 'slug' | 'metadata'>>()).results;
      },
    ));
    if (results) {
      const entries = results.map(row => {
        const metadata = JSON.parse(row.metadata);
        return { slug: row.slug, metadata: kind === 'jobs' && revision === generatedAt ? currentJobMetadata(row.slug, metadata) : metadata };
      }).filter(({ metadata }) => kind !== 'jobs' || !activeAt || isActiveJobRow(metadata, activeAt)) as CatalogEntry<K>[];
      let snapshotPayloads: Promise<Map<string, CatalogRow<K>['payload']>> | undefined;
      return {
        entries,
        revision,
        async read(slugs: readonly string[]) {
          if (!slugs.length) return [];
          const payloads = await tryDatabaseRead(kind, async () => {
            const rows = await Promise.all(Array.from({ length: Math.ceil(slugs.length / 80) }, (_, i) => {
              const chunk = slugs.slice(i * 80, i * 80 + 80);
              return database.prepare(`SELECT slug, payload FROM catalog_${kind} WHERE slug IN (${chunk.map(() => '?').join(',')})`)
                .bind(...chunk).all<Pick<StoredRow, 'slug' | 'payload'>>();
            }));
            return new Map(rows.flatMap(row => row.results).map(row => [
              row.slug, JSON.parse(row.payload) as CatalogRow<K>['payload'],
            ]));
          });
          if (payloads) return selectPayloads<K>(payloads, slugs);
          snapshotPayloads ??= loadSnapshot().then(rows => new Map(rows.map(row => [row.slug, row.payload])));
          return selectPayloads<K>(await snapshotPayloads, slugs);
        },
      };
    }
  }
  const fallback = await loadSnapshot();
  const payloads = new Map(fallback.map(row => [row.slug, row.payload]));
  const entries = fallback.map(({ slug, metadata }) => ({ slug, metadata }));
  return {
    entries,
    revision: kind === 'jobs' ? generatedAt : null,
    async read(slugs: readonly string[]) {
      return selectPayloads<K>(payloads, slugs);
    },
  };
}
