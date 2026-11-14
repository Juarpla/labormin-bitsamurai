import { openTrainingPrograms, openCatalog } from './catalog';
import { trainingDepartment } from './training';
import { searchText } from './pagination';
import { roleTopics, topicLabel, trainingOverlap } from './job-matching.mjs';
import type { Job } from '../schemas';

export async function trainingForJob(job: Job, region?: string, semantic: Record<string, number> = {}) {
  const evidence = roleTopics(job);
  if (!evidence.title.length && !evidence.requirements.length && !Object.keys(semantic).length) return [];
  const [programs, centers] = await Promise.all([openTrainingPrograms(), openCatalog('training')]);
  const byCenter = new Map(centers.entries.map(entry => [entry.slug, entry.metadata]));
  const directoryLocation = ` ${searchText(`${job.city ?? ''} ${job.locationRaw ?? ''}`)} `;
  const ranked = programs.entries.flatMap(({ slug, metadata }) => {
    const center = byCenter.get(metadata.center);
    if (!center || (job.country !== 'PE' && metadata.mode !== 'virtual')) return [];
    const { direct, supported } = trainingOverlap(evidence, metadata.search || metadata.title);
    const similarity = semantic[slug] ?? 0;
    // A vector can reorder evidence-backed results. Generic lexical matches
    // and similarity alone do not establish a published admission requirement.
    if (!direct.length && !supported.length) return [];
    // Do not recommend restaurant or retail logistics as the main match for a mine.
    if (direct.includes('logistics') && /\b(?:restaurante|restaurantes|gastronomia)\b/.test(searchText(metadata.title))) return [];
    const department = trainingDepartment('', metadata.location ?? '') || trainingDepartment(center.department, center.location);
    const local = metadata.mode !== 'virtual' && Boolean(department && (region ? department === region : directoryLocation.includes(` ${searchText(department)} `)));
    const location = metadata.mode === 'virtual' ? 'Virtual desde Perú' : metadata.location ?? center.location;
    const intermediate = supported.includes('spreadsheets') &&
      /\b(?:excel|office)\b.{0,24}\bintermedio\b/i.test(job.description) &&
      /\bintermedio\b/i.test(metadata.title);
    const score = Number(intermediate) * 7 + (direct.length ? 30 : 14) + Number(local) * 9 + Number(metadata.mode === 'virtual') * 5 +
      Number(metadata.indexable) * 2 + similarity * 6;
    return [{ slug, metadata, center, location, local, score, topic: topicLabel(direct[0] ?? supported[0]) }];
  }).sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

  const results: typeof ranked = [];
  const seen = new Set<string>();
  const coverage = new Map<string | null, number>();
  for (const option of ranked) {
    const key = `${option.metadata.center}:${searchText(option.metadata.title)}`;
    const limit = option.topic === topicLabel('spreadsheets') ? 1 : 2;
    if (seen.has(key) || (coverage.get(option.topic) ?? 0) >= limit) continue;
    seen.add(key);
    coverage.set(option.topic, (coverage.get(option.topic) ?? 0) + 1);
    results.push(option);
    if (results.length === 4) break;
  }
  return results;
}
