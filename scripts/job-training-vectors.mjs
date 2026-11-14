import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import programs from '../src/data/training-programs.json' with { type: 'json' };
import { roleTopics, topicLabel, trainingOverlap } from '../src/lib/job-matching.mjs';
import { sourceText } from '../src/lib/job-policy.mjs';

const model = '@cf/baai/bge-m3';
const digest = text => createHash('sha256').update(text).digest('hex');
const cachePath = process.env.JOB_VECTOR_CACHE || '/tmp/labormin-job-vectors.json';
const documents = programs.map(program => ({
  slug: `${program.center}/${program.slug}`,
  text: [program.title, program.summary, ...(program.curriculum ?? [])].filter(Boolean).join('. '),
}));

function normalize(vector) {
  if (!Array.isArray(vector) || vector.length !== 1024 || !vector.every(Number.isFinite)) throw Error('Invalid embedding');
  const norm = Math.hypot(...vector);
  if (!norm) throw Error('Empty embedding');
  return vector.map(value => value / norm);
}

export async function prepareTrainingVectors(jobs, limit) {
  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
  if (!jobs.length || !limit || !account || !token) return new Map();
  const stored = JSON.parse(await readFile(cachePath, 'utf8').catch(() => '{}'));
  const cached = stored.model === model ? stored.vectors ?? {} : {};
  const vectors = {};
  async function encode(items) {
    const unique = [...new Set(items.map(item => item.text))];
    for (let offset = 0; offset < unique.length; offset += 24) {
      const texts = unique.slice(offset, offset + 24);
      const missing = texts.filter(text => !(digest(text) in cached));
      if (missing.length) {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: missing }), signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw Error(`Workers AI embeddings HTTP ${res.status}`);
        const data = (await res.json()).result?.data;
        if (data?.length !== missing.length) throw Error('Incomplete embeddings response');
        missing.forEach((text,index) => { cached[digest(text)] = normalize(data[index]); });
      }
      texts.forEach(text => { vectors[digest(text)] = cached[digest(text)]; });
    }
  }
  const selected = jobs.slice(0, limit).map(job => {
    const topics = roleTopics(job);
    const relevant = documents.filter(doc => {
      const overlap = trainingOverlap(topics, doc.text);
      return overlap.direct.length || overlap.supported.length;
    });
    return { job, relevant, text: [job.title, ...topics.title.map(topicLabel), sourceText(job.description).slice(0, 2000)].join('. ') };
  });
  const batch = selected.filter(item => item.relevant.length);
  await encode(batch.flatMap(item => item.relevant));
  await encode(batch);
  // Only the ranked catalog keys and their scores go into the published cache.
  const result = new Map(selected.filter(item => !item.relevant.length).map(({ job }) => [job.id, {}]));
  for (const [id, scores] of batch.map(({job, relevant, text}) => {
    const query = vectors[digest(text)];
    const best = relevant.map(doc => ({
      slug: doc.slug,
      score: vectors[digest(doc.text)].reduce((sum, value, index) => sum + value * query[index], 0),
    })).sort((a,b) => b.score - a.score || a.slug.localeCompare(b.slug)).slice(0, 24);
    return [job.id, Object.fromEntries(best.map(({slug,score}) => [slug, Number(score.toFixed(4))]))];
  })) result.set(id, scores);
  if (batch.length) await writeFile(cachePath, JSON.stringify({ model, vectors: cached }));
  return result;
}
