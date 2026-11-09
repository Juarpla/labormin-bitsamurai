#!/usr/bin/env node
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { callProvider } from '../src/lib/llm.js';
import {
  canProcessDescription, preparePresentation, presentationChain, presentationInput, presentationKey,
} from '../src/lib/job-presentation.mjs';

const dataFile = name => new URL('../src/data/' + name, import.meta.url);
const readJson = async name => JSON.parse(await readFile(dataFile(name), 'utf8'));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const maxCalls = Number(process.env.JOB_PRESENTATION_MAX_CALLS || '30');
  if (!Number.isInteger(maxCalls) || maxCalls < 0 || maxCalls > 120) {
    throw new Error('JOB_PRESENTATION_MAX_CALLS debe ser un entero de 0 a 120');
  }
  const [{ jobs }, previous, sources] = await Promise.all([
    readJson('jobs.json'), readJson('job-presentation.json'), readJson('job-presentation-sources.json'),
  ]);
  const log = message => console.log(message);
  const chain = presentationChain(process.env, log);
  const cache = {};
  const pending = [];
  let calls = 0;
  let prepared = 0;
  let reused = 0;
  for (const job of jobs) {
    const allowed = canProcessDescription(job, sources);
    const key = presentationKey(job, allowed);
    if (previous[key]) {
      cache[key] = previous[key];
      reused++;
    } else {
      const input = presentationInput(job, allowed);
      if (input.title || input.blocks.length) pending.push({ key, input });
    }
  }
  // Newest jobs first, as sorted by ingest. A cache hit also covers duplicates.
  for (const { key, input } of pending) {
    if (calls >= maxCalls || !chain.length) break;
    if (cache[key]) continue;
    try {
      const result = await preparePresentation(input, chain, {
        log,
        request: (provider, options) => {
          if (calls >= maxCalls) throw new Error('límite de llamadas de esta ejecución');
          calls++;
          return callProvider(provider, options);
        },
      });
      cache[key] = result;
      prepared++;
    } catch {
      // Missing entry keeps the local view and lets the next batch retry.
    }
  }
  const filename = dataFile('job-presentation.json');
  const temporary = new URL(filename.href + '.tmp');
  await writeFile(temporary, JSON.stringify(cache, null, 2) + '\n');
  await rename(temporary, filename);
  const deferred = pending.filter(({ key }) => !cache[key]).length;
  log('Vista clara: ' + prepared + ' resultados nuevos, ' + reused + ' reutilizados, ' +
    deferred + ' vacantes pendientes, ' + calls + '/' + maxCalls + ' llamadas');
}
