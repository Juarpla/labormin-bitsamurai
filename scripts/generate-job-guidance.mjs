import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { callProvider, extractJson, resolveChain } from '../src/lib/llm.js';
import {
  careerGuidanceContext, careerGuidanceMessages, careerGuidanceSignature, validCareerGuidance,
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
const candidates = [];
const contexts = new Map();
for (const job of jobs) {
  if (!isCurrentGuidanceJob(job, now)) continue;
  const context = job.internship ? guidanceContext(job) : careerGuidanceContext(job, jobs, now);
  if (job.internship && !context.skillId) continue;
  const signature = job.internship ? guidanceSignature(context) : careerGuidanceSignature(context);
  const field = job.internship ? 'signature' : 'careerSignature';
  const valid = job.internship
    ? entry => entry?.signature === signature && validGuidanceQuestions(entry.questionIds, context)
    : entry => entry?.careerSignature === signature && validCareerGuidance(entry, context);
  const messages = job.internship ? guidanceMessages : careerGuidanceMessages;
  candidates.push({ id: job.id, signature, field });
  contexts.set(signature, { valid, messages: () => messages(context) });
}

// Identical prompts can share a selection, even when the original job expires.
const bySignature = new Map();
for (const entry of cache.values()) {
  const signature = entry.careerSignature ?? entry.signature;
  if (!contexts.get(signature)?.valid(entry)) continue;
  const previous = bySignature.get(signature);
  if (!previous || Date.parse(previous.generatedAt) < Date.parse(entry.generatedAt)) {
    bySignature.set(signature, entry);
  }
}

const activeProviders = new Set(providers);
let calls = 0;
let generated = 0;
let reused = 0;

for (const { id, signature, field } of candidates) {
  const context = contexts.get(signature);
  const existing = cache.get(id);
  if (context.valid(existing)) continue;

  const shared = bySignature.get(signature);
  if (shared) {
    cache.set(id, shared);
    reused += 1;
    continue;
  }

  for (const provider of activeProviders) {
    if (calls >= maxCalls) break;
    calls += 1;
    let content;
    try {
      content = await callProvider(provider, {
        messages: context.messages(),
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
    const entry = {
      [field]: signature,
      questionIds: result?.questionIds,
      ...(field === 'careerSignature' && {
        tipId: result?.tipId, trainingIds: result?.trainingIds, opportunityIds: result?.opportunityIds,
      }),
      generatedAt: now.toISOString(),
    };
    if (!context.valid(entry)) continue;
    cache.set(id, entry);
    bySignature.set(signature, entry);
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
console.log(`Job guidance: ${generated} generated, ${reused} reused, ${calls}/${maxCalls} provider calls.`);
