#!/usr/bin/env node
/** Read-only public-source revalidation. Dry run unless --write is passed.
 * Keeps URLs, IDs, reference dates and source wording; inaccessible sources
 * keep their existing integrity state. No paid services or LLM calls. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceJobDetail } from './ingest.mjs';
import { certifyJob } from '../src/lib/job-policy.mjs';

const feedPath = new URL('../src/data/jobs.json', import.meta.url);
const feed = JSON.parse(await fs.readFile(feedPath, 'utf8'));
const supported = new Set(['sapsf-csb', 'gupy', 'smartrecruiters', 'pageup']);
const checkedAt = new Date().toISOString();
const results = [];
for (let i = 0; i < feed.jobs.length; i++) {
  const job = feed.jobs[i];
  if (!supported.has(job.source) || job.descriptionStatus === 'full') continue;
  try {
    const response = await fetch(job.url, {
      headers: { 'User-Agent': 'LaborminBot/1.0 (+https://labormin.com/about)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Redirects to a board homepage cannot verify the original vacancy.
    const requested = new URL(job.url);
    const received = new URL(response.url);
    if (received.hostname !== requested.hostname || received.pathname.replace(/\/$/, '') !== requested.pathname.replace(/\/$/, '')) {
      throw new Error('Redirected away from the vacancy');
    }
    const detail = sourceJobDetail(await response.text());
    if (!detail) throw new Error('No complete marked description');
    feed.jobs[i] = certifyJob({ ...job, ...detail, fetchedAt: checkedAt });
    results.push({ id: job.id, url: job.url, status: 'verified-full',
      publishedAt: detail.publishedAt, validThrough: detail.validThrough,
      beforeCharacters: job.description.length, afterCharacters: detail.description.length,
      sha256: createHash('sha256').update(detail.description).digest('hex') });
  } catch (error) {
    results.push({ id: job.id, url: job.url, status: 'unchanged', reason: error.message });
  }
  console.log(`${results.at(-1).status}: ${job.id}`);
  await new Promise(resolve => setTimeout(resolve, 400));
}
const write = process.argv.includes('--write');
if (write) {
  // This is a detail check, not a refresh of the full feed.
  await fs.writeFile(feedPath, JSON.stringify(feed, null, 2) + '\n');
  await fs.writeFile(new URL('../docs/JOB-DETAIL-REFRESH.json', import.meta.url),
    JSON.stringify({ checkedAt, results }, null, 2) + '\n');
}
console.log(JSON.stringify({ write, checked: results.length, verified: results.filter(r => r.status === 'verified-full').length }));
