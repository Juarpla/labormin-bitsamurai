import type { APIRoute } from 'astro';
import { generatedAt } from '../../src/lib/jobs';
import { snapshotRows } from '../../src/lib/catalog-data';
import feed from '../../src/data/jobs.json';

export const prerender = true;
export const GET: APIRoute = async () => Response.json({
  jobsRevision: generatedAt,
  jobSourceCount: feed.jobs.length,
  jobs: await snapshotRows('jobs'),
  training: await snapshotRows('training'),
  events: await snapshotRows('events'),
  guides: await snapshotRows('guides'),
});
