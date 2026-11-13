import { allJobs, catalogTime, clearViewFor, tierOf, titleFor } from './jobs';
import { jobExpiration } from './job-policy.mjs';
import { education } from './education';
import { events } from './events';
import { editorialGuides, visualGuides, type GuideMetadata } from './editorial-guides';
import { searchText } from './pagination';
import trainingPrograms from '../data/training-programs.json';
import { programKey, programMetadata, programSchema } from './training-program.mjs';
import { jobTrainingEvidence } from './training-topics.mjs';
import type { Event, Job } from '../schemas';
import type { z } from 'zod';

export type CatalogKind = keyof CatalogTypes;
export type JobRecord = { job: Job | null; clearView?: ReturnType<typeof clearViewFor> };
export type JobMeta = {
  // Older D1 imports may still contain archived rows during a deployment.
  type: 'job' | 'internship' | 'archived';
  closesAt: string | null;
  country: string;
  category: string;
  remote: boolean;
  remoteFromPeru?: boolean;
  tier: number;
  search: string;
  excerptKey: string;
  training?: NonNullable<ReturnType<typeof jobTrainingEvidence>> | null;
};
export type Training = typeof education[number];
export type TrainingMeta = Pick<Training, 'type' | 'department' | 'mode' | 'costKind' | 'name' | 'location' | 'costLabel'> & { search: string };
export type TrainingProgram = z.infer<typeof programSchema>;
export type TrainingProgramMeta = ReturnType<typeof programMetadata>;
export type GuideSummary = Omit<GuideMetadata, 'steps'> & { visual?: boolean };
export type GuideArticle = (GuideSummary & { visual: true }) | (GuideMetadata & { visual?: false; html: string; updatedAt: string });
export type EventMeta = { endsOn: string; date: string };
type CatalogTypes = {
  jobs: [JobMeta, JobRecord];
  training: [TrainingMeta, Training];
  programs: [TrainingProgramMeta, TrainingProgram];
  events: [EventMeta, Event];
  guides: [GuideSummary, GuideArticle];
};
export type CatalogEntry<K extends CatalogKind> = { slug: string; metadata: CatalogTypes[K][0] };
export type CatalogRow<K extends CatalogKind> = CatalogEntry<K> & { payload: CatalogTypes[K][1] };

export function isActiveJobRow(metadata: JobMeta, now: string) {
  return (metadata.type === 'job' || metadata.type === 'internship') &&
    (!metadata.closesAt || metadata.closesAt > now);
}

function jobRow(job: Job): CatalogRow<'jobs'> {
  const expiration = jobExpiration(job);
  return {
    slug: job.slug,
    metadata: {
      type: job.internship && job.country === 'PE' ? 'internship' : 'job',
      closesAt: expiration?.date ?? null,
      country: job.country,
      category: job.category,
      remote: job.remote,
      remoteFromPeru: job.remoteEligibility.status === 'peru-supported',
      tier: tierOf(job),
      search: searchText(`${titleFor(job, 'es')} ${job.title} ${job.company} ${job.city ?? ''} ${job.locationRaw ?? ''}`),
      excerptKey: job.excerpt.trim().replace(/\s+/g, ' ').toLowerCase(),
      training: jobTrainingEvidence(job) ?? null,
    },
    payload: { job, clearView: clearViewFor(job) },
  };
}

const compareTraining = (a: Training, b: Training) => {
  const rank = ['capacita-t', 'jovenes-productivos', 'promae-comas', 'cetpro-juliaca'];
  const order = (item: Training) => rank.includes(item.id) ? rank.indexOf(item.id) : rank.length;
  return order(a) - order(b);
};

function guideSummary(guide: GuideSummary): GuideSummary {
  return { title: guide.title, description: guide.description, group: guide.group, icon: guide.icon, visual: guide.visual };
}

export const guideDate = '2026-11-12';

const snapshot = {
  jobs: () => allJobs.map(jobRow),
  training: () => [...education].sort(compareTraining).map(option => ({
    slug: option.id,
    metadata: {
      type: option.type, department: option.department, mode: option.mode, costKind: option.costKind,
      name: option.name, location: option.location, costLabel: option.costLabel,
      search: searchText(`${option.title} ${option.name} ${option.location} ${option.program}`),
    },
    payload: option,
  })),
  programs: () => programSchema.array().parse(trainingPrograms).map(program => ({
    slug: programKey(program), metadata: programMetadata(program), payload: program,
  })),
  events: () => events.map(event => ({
    slug: event.id,
    metadata: { endsOn: event.endDate ?? event.date, date: event.date },
    payload: event,
  })),
  guides: async () => [
    ...visualGuides.map(guide => {
      const payload = { ...guideSummary(guide), visual: true as const };
      return { slug: guide.slug, metadata: payload, payload };
    }),
    ...await Promise.all(editorialGuides.map(async guide => ({
      slug: guide.slug,
      metadata: guideSummary(guide),
      payload: { ...guideSummary(guide), visual: false as const, steps: guide.steps, html: await guide.compiledContent(), updatedAt: guideDate },
    }))),
  ],
} satisfies { [K in CatalogKind]: () => CatalogRow<K>[] | Promise<CatalogRow<K>[]> };

const memo = new Map<CatalogKind, Promise<unknown[]>>();
export async function snapshotRows<K extends CatalogKind>(kind: K): Promise<CatalogRow<K>[]> {
  if (!memo.has(kind)) memo.set(kind, Promise.resolve(snapshot[kind]()));
  return await memo.get(kind) as CatalogRow<K>[];
}

export function catalogNow() {
  // Astro's build sandbox can report the Unix epoch while prerendering.
  return new Date(Math.max(Date.now(), catalogTime.getTime()));
}
