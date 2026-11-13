import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export const sqlText = value => "'" + String(value).replaceAll("'", "''") + "'";

export function catalogWrangler({ cwd, remote }) {
  const executable = resolve('node_modules/.bin/wrangler');
  const env = { ...process.env };
  if (remote) {
    const envFile = resolve('.env');
    const local = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
    const catalogToken = env.CATALOG_D1_API_TOKEN || local.CATALOG_D1_API_TOKEN;
    if (catalogToken) {
      env.CLOUDFLARE_API_TOKEN = catalogToken;
      env.CLOUDFLARE_ACCOUNT_ID ||= local.CLOUDFLARE_ACCOUNT_ID;
    }
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
