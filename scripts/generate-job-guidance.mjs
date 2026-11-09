import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { callProvider, extractJson, resolveChain } from '../src/lib/llm.js';
import {
  guidanceContext, guidanceMessages, guidanceSignature, isCurrentGuidanceJob, validGuidanceQuestions,
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
  ? process.env.JOB_GUIDANCE_PROVIDER_ORDER || 'AGNES_MODEL'
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
const activeProviders = new Set(providers);
let calls = 0;
let generated = 0;

for (const job of jobs) {
  if (calls >= maxCalls || !activeProviders.size) break;
  if (!isCurrentGuidanceJob(job, now)) continue;
  const context = guidanceContext(job);
  if (!context.skillId) continue;
  const signature = guidanceSignature(context);
  const existing = cache.get(job.id);
  if (existing?.signature === signature && validGuidanceQuestions(existing.questionIds, context)) continue;

  for (const provider of activeProviders) {
    if (calls >= maxCalls) break;
    calls += 1;
    let content;
    try {
      content = await callProvider(provider, {
        messages: guidanceMessages(context),
        maxTokens: 1600,
        timeoutMs: 25000,
      });
    } catch {
      // Back off a failed provider for the remainder of the run, even on retries.
      activeProviders.delete(provider);
      console.warn(`Job guidance provider unavailable: ${provider.name}. Remaining work will retry on a later run.`);
      continue;
    }

    let result;
    try {
      result = JSON.parse(extractJson(content));
    } catch {
      console.warn(`Invalid job guidance JSON from ${provider.name}.`);
    }
    if (!validGuidanceQuestions(result?.questionIds, context)) continue;

    cache.set(job.id, { signature, questionIds: result.questionIds, generatedAt: now.toISOString() });
    generated += 1;
    break;
  }
}

const output = JSON.stringify(Object.fromEntries(cache), null, 2) + '\n';
if (output !== original) {
  const temp = new URL(`../src/data/.job-guidance-${process.pid}.json`, import.meta.url);
  await writeFile(temp, output, { flag: 'wx' });
  await rename(temp, cacheFile);
}
console.log(`Job guidance: ${generated} saved, ${calls}/${maxCalls} provider calls.`);
