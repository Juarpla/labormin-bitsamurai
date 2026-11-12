import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { catalogWrangler, sqlText as quote } from './wrangler.mjs';

const args = process.argv.slice(2).filter(arg => arg !== '--');
const remote = args.includes('--remote');
const jobsOnly = args.includes('--jobs-only');
const exportFile = args.find(arg => !arg.startsWith('--'));
if (args.some(arg => arg.startsWith('--') && !['--remote', '--jobs-only'].includes(arg))) {
  throw new Error('Uso: node scripts/catalog/import.mjs [--remote] [--jobs-only] [archivo.json]');
}
const deployConfig = '.wrangler/deploy/config.json';
const originalDeploy = !exportFile && existsSync(deployConfig) ? readFileSync(deployConfig, 'utf8') : null;
const temp = mkdtempSync(join(tmpdir(), 'labormin-catalog-'));
function run(cmd, params, options = {}) {
  const result = spawnSync(cmd, params, { stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${cmd} terminó con código ${result.status}`);
}
try {
  const out = join(temp, 'dist');
  if (!exportFile) run('pnpm', ['astro', 'build', '--outDir', out], {
    env: { ...process.env, LABORMIN_EXPORT_CATALOG: '1' },
  });
  const data = JSON.parse(readFileSync(exportFile ?? join(out, 'client', '_catalog-export.json'), 'utf8'));
  if (typeof data.jobsRevision !== 'string' || !Number.isFinite(Date.parse(data.jobsRevision))) throw new Error('Falta la fecha de la edición del feed.');
  const kinds = jobsOnly ? ['jobs'] : ['jobs', 'training', 'events', 'guides'];
  const statements = [];
  const revision = quote(data.jobsRevision);
  const newEnough = `NOT EXISTS (SELECT 1 FROM catalog_ready WHERE name = 'jobs' AND source_revision > ${revision})`;
  for (const kind of kinds) {
    const rows = data[kind];
    if (!Array.isArray(rows) || !rows.length || new Set(rows.map(row => row.slug)).size !== rows.length) {
      throw new Error(`Catálogo ${kind} vacío o con identificadores duplicados`);
    }
    // Editorial data is seeded once. Subsequent releases must not overwrite
    // additions or corrections made in D1. The feed alone is regenerated.
    const table = `catalog_${kind}`;
    if (kind === 'jobs') statements.push(`DELETE FROM ${table} WHERE ${newEnough};`);
    rows.forEach((row, position) => {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(row.slug)) throw new Error(`Slug inválido en ${kind}: ${row.slug}`);
      const columns = [quote(row.slug), position, quote(JSON.stringify(row.metadata)), quote(JSON.stringify(row.payload))].join(',');
      statements.push(kind === 'jobs'
        ? `INSERT INTO ${table}(slug, position, metadata, payload) SELECT ${columns} WHERE ${newEnough};`
        : `INSERT INTO ${table}(slug, position, metadata, payload) SELECT ${columns} WHERE NOT EXISTS (SELECT 1 FROM catalog_ready WHERE name = ${quote(kind)});`);
    });
    statements.push(`INSERT INTO catalog_ready VALUES (${quote(kind)}, ${quote(new Date().toISOString())}, ${kind === 'jobs' ? quote(data.jobsRevision) : 'NULL'}) ON CONFLICT(name) DO UPDATE SET imported_at=excluded.imported_at, source_revision=excluded.source_revision WHERE excluded.name='jobs' AND (catalog_ready.source_revision IS NULL OR excluded.source_revision >= catalog_ready.source_revision);`);
    console.log(`${kind}: ${rows.length} registros en la instantánea`);
  }
  const sql = join(temp, 'import.sql');
  writeFileSync(sql, statements.join('\n'), { mode: 0o600 });
  const wrangler = catalogWrangler({ cwd: temp, remote });
  wrangler.migrate();
  wrangler.apply(sql);
  const [counts] = wrangler.query(`SELECT ${kinds.map(kind =>
    `(SELECT COUNT(*) FROM catalog_${kind} WHERE EXISTS (SELECT 1 FROM catalog_ready WHERE name = ${quote(kind)})) AS ${kind}`
  ).join(',')};`);
  const [stored] = wrangler.query("SELECT source_revision FROM catalog_ready WHERE name = 'jobs';");
  if (stored?.source_revision > data.jobsRevision) {
    console.log('D1 ya tiene un feed más reciente; se conservó esa edición.');
  } else if (!counts || stored?.source_revision !== data.jobsRevision || counts.jobs !== data.jobs.length || kinds.some(kind => !counts[kind])) throw new Error('La verificación de D1 no coincide con la importación.');
  console.log('Importación confirmada por D1:', counts);
} finally {
  // Astro writes an ignored deploy redirect even for --outDir. Restore the
  // previous redirect if the current one still belongs to this export.
  if (!exportFile && existsSync(deployConfig) && readFileSync(deployConfig, 'utf8').includes(basename(temp))) {
    if (originalDeploy === null) rmSync(deployConfig);
    else writeFileSync(deployConfig, originalDeploy);
  }
  rmSync(temp, { recursive: true, force: true });
}
