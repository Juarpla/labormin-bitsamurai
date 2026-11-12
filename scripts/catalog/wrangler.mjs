import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export const sqlText = value => "'" + String(value).replaceAll("'", "''") + "'";

export function catalogWrangler({ cwd, remote }) {
  const executable = resolve('node_modules/.bin/wrangler');
  const env = { ...process.env };
  if (remote && !env.CLOUDFLARE_API_TOKEN && env.CATALOG_D1_API_TOKEN) {
    env.CLOUDFLARE_API_TOKEN = env.CATALOG_D1_API_TOKEN;
  }
  const binding = [
    'CATALOG_DB', remote ? '--remote' : '--local', '--config', resolve('wrangler.jsonc'),
    ...(!remote ? ['--persist-to', resolve('.wrangler/state')] : []),
  ];
  function run(args, inherit = false) {
    const result = spawnSync(executable, args, {
      cwd, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...(inherit ? { stdio: 'inherit' } : {}),
    });
    if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr || result.stdout || 'Wrangler no pudo terminar.');
    return result.stdout;
  }
  return {
    migrate: () => run(['d1', 'migrations', 'apply', ...binding], true),
    apply: file => run(['d1', 'execute', ...binding, '--file', file, '--json']),
    query: sql => {
      const result = JSON.parse(run(['d1', 'execute', ...binding, '--command', sql, '--json']));
      if (!Array.isArray(result) || !result.length || result.some(item => !item.success)) throw new Error('D1 no confirmó la consulta.');
      return result.flatMap(item => item.results ?? []);
    },
  };
}
