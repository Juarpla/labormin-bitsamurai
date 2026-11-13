import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogWrangler, sqlText as quote } from './wrangler.mjs';
import { programKey, programMetadata, programSchema } from '../../src/lib/training-program.mjs';

const args = process.argv.slice(2);
const files = args.filter(arg => !arg.startsWith('--'));
if (files.length > 1 || args.some(arg => arg.startsWith('--') && arg !== '--remote')) {
  throw new Error('Uso: node scripts/catalog/publish-training.mjs [programa.json] [--remote]');
}
const [file] = files;
const remote = args.includes('--remote');
const data = JSON.parse(readFileSync(file ?? new URL('../../src/data/training-programs.json', import.meta.url), 'utf8'));
const programs = programSchema.array().nonempty().parse(Array.isArray(data) ? data : [data]);
const keys = new Set(programs.map(programKey));
if (keys.size !== programs.length) throw new Error('Hay programas con la misma URL.');

const temp = mkdtempSync(join(tmpdir(), 'labormin-training-'));
try {
  const wrangler = catalogWrangler({ cwd: temp, remote });
  wrangler.migrate();
  const ready = wrangler.query("SELECT name FROM catalog_ready WHERE name IN ('training', 'programs');");
  if (!ready.some(row => row.name === 'training')) throw new Error('Primero importa los centros en catalog_training.');
  if (file && !ready.some(row => row.name === 'programs')) throw new Error('Primero carga la edición inicial de programas sin pasar un archivo.');
  const centers = new Set(wrangler.query('SELECT slug FROM catalog_training;').map(row => row.slug));
  const missing = [...new Set(programs.map(program => program.center).filter(center => !centers.has(center)))];
  if (missing.length) throw new Error(`Centros fuera de D1: ${missing.join(', ')}`);

  const sql = join(temp, 'training.sql');
  function apply(statements) {
    writeFileSync(sql, statements.join('\n'), { mode: 0o600 });
    wrangler.apply(sql);
  }
  const rows = programs.map(program => ({ key: programKey(program), program, payload: JSON.stringify(program) }));
  const upsert = file ? 'DO UPDATE SET metadata = excluded.metadata, payload = excluded.payload' : 'DO NOTHING';
  apply(rows.map(({ key, program, payload }, position) => `INSERT INTO catalog_programs(slug, center_slug, position, metadata, payload)
    VALUES (${quote(key)}, ${quote(program.center)}, ${position}, ${quote(JSON.stringify(programMetadata(program)))}, ${quote(payload)})
    ON CONFLICT(slug) ${upsert};`));

  const stored = wrangler.query('SELECT slug FROM catalog_programs;');
  const storedKeys = new Set(stored.map(record => record.slug));
  if (rows.some(({ key }) => !storedKeys.has(key))) throw new Error('D1 no confirmó todos los programas.');
  if (file) {
    for (let offset = 0; offset < rows.length; offset += 40) {
      const chunk = rows.slice(offset, offset + 40);
      const values = wrangler.query(`SELECT slug, payload FROM catalog_programs WHERE slug IN (${chunk.map(({ key }) => quote(key)).join(',')});`);
      const byKey = new Map(values.map(record => [record.slug, record.payload]));
      if (chunk.some(({ key, payload }) => byKey.get(key) !== payload)) throw new Error('D1 no confirmó la edición de los programas.');
    }
  }
  if (!ready.some(row => row.name === 'programs')) {
    apply([`INSERT INTO catalog_ready VALUES ('programs', ${quote(new Date().toISOString())}, NULL) ON CONFLICT(name) DO NOTHING;`]);
  }
  const [counts] = wrangler.query(`SELECT COUNT(*) AS programs, COUNT(DISTINCT center_slug) AS centers,
    SUM(json_extract(metadata, '$.indexable')) AS indexable FROM catalog_programs
    WHERE EXISTS (SELECT 1 FROM catalog_ready WHERE name = 'programs');`);
  if (!counts?.programs) throw new Error('D1 no confirmó el catálogo de formación.');
  console.log(`D1 ${remote ? 'remoto' : 'local'}: ${counts.programs} programas de ${counts.centers} centros; ${counts.indexable} fichas revisadas.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
