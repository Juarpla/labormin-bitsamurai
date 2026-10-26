#!/usr/bin/env node
/** Offline, deterministic repair. Default is a dry run; --write persists a
 * corrected active feed, a minimal archive and an audit report. No network/LLM. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { certifyJob, inNiche, sourceText, POLICY_VERSION, isExpired } from '../src/lib/job-policy.mjs';

export function repairFeed(feed, { now = new Date(), previousArchive = [] } = {}) {
  const cutoff = now.getTime() - 30 * 86400000;
  const report = { reviewedAt:now.toISOString(), originalGeneratedAt:feed.generatedAt, input:feed.jobs.length, corrected:0, visaFlagsRemoved:0, salariesChanged:0, remoteUnconfirmed:0, incompleteDescriptions:0, excluded:0, active:0, reasons:{}, records:[] };
  const jobs = [], archive = new Map(previousArchive.map(j => [j.slug,j])), seen = new Set();
  for (const old of feed.jobs) {
    const job = certifyJob(old, {legacy:old.policyVersion !== POLICY_VERSION});
    if (JSON.stringify(job) !== JSON.stringify(old)) report.corrected++;
    if (old.visaReported && !job.visaReported) report.visaFlagsRemoved++;
    if (JSON.stringify(old.salary) !== JSON.stringify(job.salary)) report.salariesChanged++;
    if (old.remote && job.remoteEligibility.status !== 'peru-supported') report.remoteUnconfirmed++;
    if (job.descriptionStatus !== 'full') report.incompleteDescriptions++;
    const time = Date.parse(job.postedAt);
    const key = `${job.companySlug}::${job.title.toLowerCase().replace(/\W+/g,' ')}::${job.country}`;
    let reason = isExpired(job, now) ? 'expired' : !Number.isFinite(time) || time > now.getTime()+86400000 ? 'invalid-date' : time < cutoff ? 'stale' : !/^https?:\/\//.test(job.url) ? 'invalid-url' : !inNiche(job) ? 'eligibility-unverified' : sourceText(job.description).length < 80 ? 'insufficient-content' : seen.has(key) ? 'duplicate' : null;
    if (reason) {
      report.excluded++; report.reasons[reason] = (report.reasons[reason] || 0)+1;
      report.records.push({id:job.id,reason,visaStatus:job.visa.status,remoteStatus:job.remoteEligibility.status});
      archive.set(job.slug,{slug:job.slug,title:job.title,company:job.company,url:job.url,referenceDate:job.postedAt,removedAt:now.toISOString().slice(0,10),reason});
    } else { seen.add(key); archive.delete(job.slug); jobs.push(job); }
  }
  report.active = jobs.length;
  return {feed:{...feed,jobs,reviewedAt:report.reviewedAt},archive:[...archive.values()],report};
}

export async function repairStoredFeed({write = false} = {}) {
  const feedPath = new URL('../src/data/jobs.json',import.meta.url);
  const archivePath = new URL('../src/data/jobs-archive.json',import.meta.url);
  const feed = JSON.parse(await readFile(feedPath,'utf8'));
  let previousArchive = [];
  try { previousArchive = JSON.parse(await readFile(archivePath,'utf8')); } catch {}
  const result = repairFeed(feed,{previousArchive});
  if (write) {
    await writeFile(archivePath,JSON.stringify(result.archive,null,2)+'\n');
    await writeFile(feedPath,JSON.stringify(result.feed,null,2)+'\n');
    await writeFile(new URL('../docs/JOB-FEED-REPAIR.json',import.meta.url),JSON.stringify(result.report,null,2)+'\n');
  }
  const {records,...summary} = result.report;
  console.log(JSON.stringify({mode:write?'write':'dry-run',...summary},null,2));
  return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await repairStoredFeed({write:process.argv.includes('--write')});
