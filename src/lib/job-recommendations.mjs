import { careerGuidanceContext, isCurrentGuidanceJob } from './job-guidance.mjs';
import { roleTopics } from './job-matching.mjs';
import { isExpired, jobExpiration } from './job-policy.mjs';

/** @typedef {import('../schemas').Job} Job */
/** @typedef {{ slug: string, closesAt: string | null }} Recommendation */
/** @typedef {{ guidance: Recommendation[], related: Recommendation[], uniqueExcerpt: boolean }} JobRecommendations */

const isInternship = job => Boolean(job.internship && job.country === 'PE');
const market = job => JSON.stringify([job.country, job.remote]);
const dayMs = 86400000;

/** @param {Job} job */
export function jobExcerptKey(job) {
  return job.excerpt.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** @param {Job[]} jobs
 * @param {Date} now
 * @returns {Record<string, JobRecommendations>}
 */
export function buildJobRecommendations(jobs, now) {
  const active = jobs.filter(job => !isExpired(job, now)).sort((a, b) =>
    Number(b.country === 'PE') - Number(a.country === 'PE') || b.postedAt.localeCompare(a.postedAt));
  const deadlines = new Map(active.map(job => [job.slug, jobExpiration(job)?.date ?? null]));
  const generalJobs = active.filter(job => !isInternship(job));
  const titleTopics = new Map(generalJobs.map(job => [job.slug, roleTopics(job).title]));
  const excerptCount = new Map();
  const entryByMarket = new Map();
  const excerptBucket = job => JSON.stringify([isInternship(job), jobExcerptKey(job)]);
  for (const job of active) {
    const bucket = excerptBucket(job);
    excerptCount.set(bucket, (excerptCount.get(bucket) ?? 0) + 1);
    if (isCurrentGuidanceJob(job, now) && (isInternship(job) ||
        /\b(?:practicante|trainee|becari[oa]|auxiliar|ayudante|asistente|junior|jr|operari[oa])\b/i.test(job.title))) {
      const key = market(job);
      if (!entryByMarket.has(key)) entryByMarket.set(key, []);
      entryByMarket.get(key).push(job);
    }
  }
  return Object.fromEntries(active.map(job => {
    const { opportunities } = careerGuidanceContext(job, entryByMarket.get(market(job)) ?? [], now);
    const guidance = opportunities.map(({ job: match }) => {
      const closesAt = deadlines.get(match.slug);
      const guidanceCutoff = new Date(Date.parse(match.postedAt) + 30 * dayMs).toISOString();
      return { slug: match.slug, closesAt: closesAt && closesAt < guidanceCutoff ? closesAt : guidanceCutoff };
    });
    const topics = titleTopics.get(job.slug) ?? [];
    const related = job.internship ? [] : generalJobs.flatMap(match => {
      if (match.id === job.id || match.remote !== job.remote) return [];
      const otherTopics = titleTopics.get(match.slug) ?? [];
      const overlap = topics.filter(topic => otherTopics.includes(topic)).length;
      const sameCategory = job.category !== 'other' && job.category === match.category;
      if (!overlap && (!sameCategory || (topics.length && otherTopics.length))) return [];
      return [{ match, score: 4 * overlap + 2 * Number(sameCategory) + Number(match.country === job.country) }];
    }).sort((a, b) => b.score - a.score).slice(0, 10)
      .map(({ match }) => ({ slug: match.slug, closesAt: deadlines.get(match.slug) ?? null }));
    return [job.slug, { guidance, related, uniqueExcerpt: Boolean(jobExcerptKey(job)) && excerptCount.get(excerptBucket(job)) === 1 }];
  }));
}
