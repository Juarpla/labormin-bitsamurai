import { openCatalog } from './catalog';
import { isActiveJobRow, type JobMeta, type Training, type TrainingProgram } from './catalog-data';
import { allJobs } from './jobs';
import { isExpired } from './job-policy.mjs';
import { searchText } from './pagination';
import { trainingDepartment } from './training';
import { jobTrainingEvidence, matchTrainingJob, topicsForProgram, trainingTopics } from './training-topics.mjs';
import type { Job } from '../schemas';

type Evidence = JobMeta['training'];
type Match = NonNullable<ReturnType<typeof matchTrainingJob>>;
export type TrainingOpportunity = { job: Job; match: Match };
const groups = ['job', 'internship'] as const;

// An already deployed D1 snapshot may lack training metadata until the next
// feed sync. Index the bundled originals once in that Worker, not per page.
let previousEvidence: Map<string, Evidence> | undefined;
function evidenceForPreviousFeed() {
  return previousEvidence ??= new Map(allJobs.map(job => [job.slug, jobTrainingEvidence(job) ?? null]));
}

export async function trainingOpportunities(program: TrainingProgram, center: Training, now: Date) {
  const topics = program.topics ?? topicsForProgram(program.title);
  const result: Record<(typeof groups)[number], TrainingOpportunity[]> = { job: [], internship: [] };
  if (!topics.length) return result;
  const at = now.toISOString();
  const catalog = await openCatalog('jobs', undefined, at);
  const region = trainingDepartment('', program.location?.label ?? '') || trainingDepartment(center.department, center.location);
  const department = ` ${searchText(region)} `;
  const candidates = catalog.entries.flatMap(({ slug, metadata }) => {
    if (!isActiveJobRow(metadata, at)) return [];
    const evidence = metadata.training === undefined ? evidenceForPreviousFeed().get(slug) : metadata.training;
    const match = matchTrainingJob(topics, evidence);
    if (!match || !evidence) return [];
    const local = program.mode !== 'virtual' && Boolean(region) && ` ${evidence.location} `.includes(department);
    return [{ slug, type: metadata.type, match, local, postedAt: evidence.postedAt }];
  });
  candidates.sort((a, b) => Number(b.match.kind === 'direct') - Number(a.match.kind === 'direct') ||
    Number(b.local) - Number(a.local) || b.postedAt.localeCompare(a.postedAt) || a.slug.localeCompare(b.slug));

  for (const type of groups) {
    const slugs = candidates.filter(item => item.type === type).map(item => item.slug);
    const seen = new Set<string>();
    // Read only a small batch of full listings, even on a popular subject.
    for (let offset = 0; offset < slugs.length && result[type].length < 3; offset += 8) {
      const records = await catalog.read(slugs.slice(offset, offset + 8));
      for (const { job } of records) {
        if (!job || isExpired(job, now) || (job.internship && job.country === 'PE' ? 'internship' : 'job') !== type) continue;
        const match = matchTrainingJob(topics, jobTrainingEvidence(job));
        const key = searchText(`${job.companySlug || job.company} ${job.title} ${job.city ?? job.locationRaw}`).replace(/[^a-z0-9]+/g, ' ');
        if (!match || seen.has(key)) continue;
        seen.add(key);
        result[type].push({ job, match });
        if (result[type].length === 3) break;
      }
    }
  }
  return result;
}

export function trainingMatchText(match: Match) {
  const topic = trainingTopics[match.topic].label;
  const where = match.inTitle ? 'el puesto' : 'los requisitos';
  return match.kind === 'direct'
    ? `Coincide en ${topic} con ${where}.`
    : `${topic[0].toUpperCase()}${topic.slice(1)} figura en ${where} y se relaciona con ${trainingTopics[match.subject].label}.`;
}
