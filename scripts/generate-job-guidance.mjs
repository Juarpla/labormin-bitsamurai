import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { analysisContext, analysisMessages, analysisSignature, jobAnalysis, readAnalysis } from '../src/lib/job-analysis.mjs';
import { callProvider, extractJson, resolveChain } from '../src/lib/llm.js';
import {
  careerGuidanceContext, careerGuidanceMessages, careerGuidanceSignature, validCareerGuidance,
  isCurrentGuidanceJob,
} from '../src/lib/job-guidance.mjs';

const envFile = new URL('../.env', import.meta.url);
try {
  process.loadEnvFile(fileURLToPath(envFile));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const maxCalls = Number(process.env.JOB_GUIDANCE_MAX_CALLS || 30);
if (!Number.isSafeInteger(maxCalls) || maxCalls < 0 || maxCalls > 120) {
  throw Error('JOB_GUIDANCE_MAX_CALLS must be an integer between 0 and 120.');
}
const providers = resolveChain(name => name === 'LLM_PROVIDER_ORDER'
  ? process.env.JOB_GUIDANCE_PROVIDER_ORDER
  : process.env[name], console.log);
if (!maxCalls || !providers.length) {
  console.log('Job guidance skipped. Editorial guidance remains available.');
  process.exit(0);
}

const cacheFile = new URL('../src/data/job-guidance.json', import.meta.url);
const { jobs } = JSON.parse(await readFile(new URL('../src/data/jobs.json', import.meta.url), 'utf8'));
const original = await readFile(cacheFile, 'utf8');
const now = new Date();
const cache = new Map(Object.entries(JSON.parse(original))
  .filter(([, entry]) => Date.parse(entry.generatedAt) >= now.getTime() - 90 * 86400000));
const requestedSlugs = (process.env.JOB_GUIDANCE_SLUGS ?? '').split(',').map(slug => slug.trim()).filter(Boolean);
const candidates = jobs.filter(job => isCurrentGuidanceJob(job, now) &&
  (!requestedSlugs.length || requestedSlugs.includes(job.slug)))
  .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
const missingSlugs = requestedSlugs.filter(slug => !candidates.some(job => job.slug === slug));
if (missingSlugs.length) throw new Error(`No active vacancies match: ${missingSlugs.join(', ')}`);

const activeProviders = new Set(providers);
let calls = 0;
let generated = 0;

for (const job of candidates) {
  if (calls >= maxCalls || !activeProviders.size) break;
  const context = analysisContext(job);
  const existing = cache.get(job.id);
  if (jobAnalysis(context, existing)) continue;

  const ranking = careerGuidanceContext(job, jobs, now);
  const [, catalog] = careerGuidanceMessages(ranking);
  const [analysisSystem] = analysisMessages(context);
  const messages = [
    { role: 'system', content: `${analysisSystem.content} Añade ranking como objeto con tipId (un ID), questionIds (dos IDs distintos, uno técnico si existe), trainingIds (todos los IDs ordenados por afinidad) y opportunityIds (hasta tres IDs). Escoge IDs del catálogo o devuelve listas vacías si no hay candidatos.` },
    { role: 'user', content: JSON.stringify({ vacante: context, catálogo: JSON.parse(catalog.content) }) },
  ];

  for (const provider of activeProviders) {
    if (calls >= maxCalls) break;
    calls += 1;
    let content;
    try {
      content = await callProvider(provider, { messages, maxTokens: 2000, timeoutMs: 25000 });
    } catch {
      activeProviders.delete(provider);
      console.warn(`Job guidance provider unavailable: ${provider.name}. Remaining work will retry on a later run.`);
      continue;
    }

    let result;
    try {
      result = JSON.parse(extractJson(content));
    } catch {
      console.warn(`Invalid job guidance JSON from ${provider.name}.`);
      continue;
    }
    const analysis = readAnalysis(result, context);
    if (!analysis) {
      console.warn(`Job analysis did not validate: ${job.slug} (${provider.name}).`);
      continue;
    }
    const { tipId, questionIds, trainingIds, opportunityIds } = result.ranking ?? {};
    const selection = { tipId, questionIds, trainingIds, opportunityIds };
    const ranked = validCareerGuidance(selection, ranking);
    cache.set(job.id, {
      ...existing,
      ...(ranked && { ...selection, signature: undefined, careerSignature: careerGuidanceSignature(ranking) }),
      analysisSignature: analysisSignature(context),
      analysis,
      generatedAt: now.toISOString(),
    });
    generated += 1;
    console.log(`Job guidance generated: ${job.slug} (${provider.name}).`);
    break;
  }
}
const output = JSON.stringify(Object.fromEntries(cache), null, 2) + '\n';
if (output !== original) {
  const temp = new URL(`../src/data/.job-guidance-${process.pid}.json`, import.meta.url);
  await writeFile(temp, output, { flag: 'wx' });
  await rename(temp, cacheFile);
}
console.log(`Job guidance: ${generated} generated, ${calls}/${maxCalls} provider calls.`);
