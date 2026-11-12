import type { APIRoute } from 'astro';
import { generatedAt } from '../../src/lib/jobs';
import { snapshotRows } from '../../src/lib/catalog-data';

export const prerender = true;
export const GET: APIRoute = async () => Response.json({
  jobsRevision: generatedAt,
  jobs: await snapshotRows('jobs'),
  training: await snapshotRows('training'),
  events: await snapshotRows('events'),
  guides: await snapshotRows('guides'),
});
