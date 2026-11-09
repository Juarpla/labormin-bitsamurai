import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canProcessDescription, localPresentation, preparePresentation,
  presentationChain, presentationInput, presentationKey,
} from '../../src/lib/job-presentation.mjs';

const job = {
  title: 'Maintenance Technician II',
  description: '<p>Requisitos: Experiencia con SAP.</p><p>You must have 5 years of experience and work a 14x7 roster.</p><p>No visa sponsorship available.</p>',
  descriptionStatus: 'source-extract',
  source: 'test-board',
  url: 'https://jobs.example.com/vacancy',
};
const sources = [{ source: job.source, host: 'jobs.example.com', permission: 'test fixture' }];
const providers = ['agnes', 'opencode-go', 'workers-ai', 'mistral'].map(name => ({ name }));
const valid = {
  titleEs: 'Técnico de mantenimiento II',
  blocks: [
    { id: 0, section: 'requirements', es: 'Contenido que debe ignorarse' },
    { id: 1, section: 'requirements', es: 'Debe tener 5 años de experiencia y trabajar en régimen 14x7.' },
    { id: 2, section: 'conditions', es: 'No se ofrece patrocinio de visa.' },
  ],
};

test('requires approval for the matching host and source and caches the exact version', () => {
  assert.equal(canProcessDescription(job, sources), true);
  assert.equal(canProcessDescription({ ...job, url: 'https://other.example.com/vacancy' }, sources), false);
  assert.equal(canProcessDescription({ ...job, descriptionStatus: 'unknown' }, sources), false);
  assert.notEqual(presentationKey(job, true), presentationKey(job, false));
  assert.notEqual(presentationKey(job, true), presentationKey({ ...job, description: job.description + '.' }, true));
  assert.deepEqual(presentationInput(job, false), { title: job.title, blocks: [] });
});

test('leaves unaccented Spanish titles intact and organizes source text offline', () => {
  const spanish = { ...job, title: 'ASISTENTE DE SUPERVISION CIVIL' };
  assert.deepEqual(presentationInput(spanish, false), { title: null, blocks: [] });
  assert.deepEqual(localPresentation('<p>Presentación.Requisitos: 5 años.<br>Visa &amp; permisos</p>'), [
    { heading: 'overview', blocks: ['Presentación.'] },
    { heading: 'requirements', blocks: ['5 años.', 'Visa & permisos'] },
  ]);
});

test('keeps the requested model order and reserves OpenCode until confirmed', () => {
  const env = {
    AGNES_API_KEY: 'test', OPENCODE_GO_API_KEY: 'test', CLOUDFLARE_API_TOKEN: 'test',
    CLOUDFLARE_ACCOUNT_ID: 'test', MISTRAL_API_KEY: 'test',
  };
  assert.deepEqual(presentationChain(env).map(provider => provider.name), ['agnes', 'workers-ai', 'mistral']);
  assert.deepEqual(presentationChain({ ...env, JOB_PRESENTATION_OPENCODE_ALLOWED: 'true' }).map(provider => provider.model),
    ['agnes-3.0-flash', 'mimo-v2.6-flash', '@cf/qwen/qwen3.8-27b', 'codestral-2508']);
});

test('checks coverage, shifts and visa terms, spends one correction, and fails over', async () => {
  const badRoster = structuredClone(valid);
  badRoster.blocks[1].es = 'Debe tener 5 años de experiencia y trabajar en régimen 7x14.';
  const badVisa = structuredClone(valid);
  badVisa.blocks[2].es = 'Se ofrece patrocinio de visa.';
  const omitted = { ...valid, blocks: valid.blocks.slice(0, 2) };
  const outcomes = [badRoster, badVisa, omitted, valid];
  const calls = [];
  const result = await preparePresentation(presentationInput(job, true), providers, {
    request: async (provider, options) => {
      calls.push({ name: provider.name, ...options });
      return JSON.stringify(outcomes.shift());
    },
  });
  assert.deepEqual(calls.map(call => call.name), ['agnes', 'agnes', 'opencode-go', 'workers-ai']);
  assert.equal(calls[0].sessionId, calls[1].sessionId);
  assert.match(calls[1].messages.at(-1).content, /turnos/);
  assert.equal(result.titleEs, valid.titleEs);
  assert.equal(result.sections[0].blocks[0], 'Requisitos: Experiencia con SAP.');
  assert.equal(result.sections[1].blocks[0], 'No se ofrece patrocinio de visa.');
});

test('skips the correction for service errors and invalid JSON', async () => {
  const calls = [];
  const input = presentationInput(job, false);
  const result = await preparePresentation(input, providers, {
    request: async provider => {
      calls.push(provider.name);
      if (provider.name === 'agnes') throw new Error('HTTP 429');
      if (provider.name === 'opencode-go') return 'broken response';
      return JSON.stringify(valid);
    },
  });
  assert.deepEqual(calls, ['agnes', 'opencode-go', 'workers-ai']);
  assert.deepEqual(result, { titleEs: valid.titleEs, sections: [] });
});

test('translates the English part of a mixed title and keeps the Spanish suffix verbatim', async () => {
  const input = presentationInput({ ...job, title: 'Planner de Mantenimiento - Proyecto Minero Puno' }, false);
  const result = await preparePresentation(input, providers, {
    request: async (_, { messages }) => {
      assert.deepEqual(JSON.parse(messages[1].content), { title: 'Planner', blocks: [] });
      return JSON.stringify({ titleEs: 'Planificador' });
    },
  });
  assert.equal(result.titleEs, 'Planificador de Mantenimiento - Proyecto Minero Puno');
});
