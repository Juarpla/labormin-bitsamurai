import { openTrainingPrograms, openCatalog } from './catalog';
import { trainingDepartment } from './training';
import { searchText } from './pagination';
import { jobTrainingEvidence, topicsForProgram } from './training-topics.mjs';
import type { Job } from '../schemas';

// Offer catalogued degrees whose discipline appears in the original vacancy.
// Prefer a verified work region. When the directory city is all we have, use it
// only to rank academic options, never as a claim about the worksite.
export async function degreesForJob(job: Job, region?: string) {
  if (job.country !== 'PE') return [];
  const evidence = jobTrainingEvidence(job);
  if (!evidence) return [];
  const topics = new Set([...evidence.title, ...evidence.requirements]);
  const [programs, centers] = await Promise.all([openTrainingPrograms({ indexable: true }), openCatalog('training')]);
  const byCenter = new Map(centers.entries.map(entry => [entry.slug, entry.metadata]));
  const directoryLocation = ` ${searchText(`${job.city ?? ''} ${job.locationRaw ?? ''}`)} `;
  return programs.entries.flatMap(({ slug, metadata }) => {
    const center = byCenter.get(metadata.center);
    const programTopics = topicsForProgram(metadata.title);
    if (!center || center.type !== 'carrera' || !programTopics.some(topic => topics.has(topic))) return [];
    const department = trainingDepartment('', metadata.location ?? '') || trainingDepartment(center.department, center.location);
    const local = Boolean(department && (region ? department === region : directoryLocation.includes(` ${searchText(department)} `)));
    const inTitle = programTopics.some(topic => evidence.title.includes(topic));
    return [{ slug, metadata, center, department, local, inTitle }];
  }).sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || Number(b.local) - Number(a.local))
    .slice(0, 2);
}
