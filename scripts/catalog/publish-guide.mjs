import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogWrangler, sqlText as quote } from './wrangler.mjs';
import { z } from 'zod';

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('--'));
if (!file || args.some(arg => arg.startsWith('--') && arg !== '--remote')) {
  throw new Error('Uso: node scripts/catalog/publish-guide.mjs <guía.json> [--remote]');
}
const guide = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(300),
  group: z.enum(['primer-empleo', 'formacion', 'evaluar']),
  icon: z.enum(['credential', 'materials', 'time', 'map', 'remote']),
  steps: z.tuple([z.string().min(1).max(80), z.string().min(1).max(80), z.string().min(1).max(80)]),
  updatedAt: z.iso.date(),
  html: z.string().trim().min(1).max(30000),
}).strict().parse(JSON.parse(readFileSync(file, 'utf8')));
const { slug, title, description, group, icon, ...body } = guide;
if (['formacion-minera-gratuita-economica-peru', 'verificar-oferta-remota-visa-salario'].includes(slug)) {
  throw new Error('Esa URL está reservada para una guía visual.');
}
const remote = args.includes('--remote');
const summary = { title, description, group, icon };
const temp = mkdtempSync(join(tmpdir(), 'labormin-guide-'));
try {
  const payload = JSON.stringify({...summary, ...body, visual: false});
  const sql = join(temp, 'guide.sql');
  writeFileSync(sql, `INSERT INTO catalog_guides (slug, position, metadata, payload)
    SELECT ${quote(slug)}, COALESCE(MAX(position), -1) + 1, ${quote(JSON.stringify(summary))}, ${quote(payload)}
    FROM catalog_guides WHERE EXISTS (SELECT 1 FROM catalog_ready WHERE name = 'guides')
    HAVING COUNT(*) > 0
    ON CONFLICT(slug) DO UPDATE SET metadata = excluded.metadata, payload = excluded.payload;\n`, {mode: 0o600});
  const wrangler = catalogWrangler({ cwd: temp, remote });
  wrangler.apply(sql);
  const [stored] = wrangler.query(`SELECT payload FROM catalog_guides WHERE slug = ${quote(slug)};`);
  if (stored?.payload !== payload) throw new Error('D1 no guardó la guía. Primero importa el catálogo inicial.');
  console.log(`Guía guardada en ${remote ? 'D1 remoto' : 'D1 local'}: /guias/${slug}/`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
