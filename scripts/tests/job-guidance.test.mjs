import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applicationGuidance, experienceOpportunity, guidanceContext, guidanceMessages,
  guidanceSignature, validGuidanceQuestions,
} from '../../src/lib/job-guidance.mjs';

const job = {
  id: 'target', title: 'Técnico de mantenimiento eléctrico', country: 'PE',
  remote: false, salary: null, postedAt: '2026-11-04',
  company: 'Company data to keep local', description: 'Third-party advert text to keep local',
};

test('the AI receives only controlled labels and editorial questions', () => {
  const context = guidanceContext(job);
  const prompt = JSON.stringify(guidanceMessages(context));
  assert.match(prompt, /electricidad/);
  for (const privateInput of [job.title, job.company, job.description]) {
    assert.equal(prompt.includes(privateInput), false);
  }
  assert.equal(validGuidanceQuestions(['equipment', 'placement'], context), true);
  assert.equal(validGuidanceQuestions(['equipment', 'equipment'], context), false);
  assert.equal(validGuidanceQuestions(['placement', 'salary-missing'], context), false);
  assert.equal(validGuidanceQuestions(['equipment', 'invented'], context), false);
});

test('stale AI selections fall back to editorial questions', () => {
  const signature = guidanceSignature(guidanceContext(job));
  const cached = { signature, questionIds: ['technical-evidence', 'salary-missing'] };
  assert.equal(applicationGuidance(job, cached).selectedByAi, true);
  assert.equal(applicationGuidance(job, cached).educationId, 'cetpro-juliaca');
  assert.equal(applicationGuidance({ ...job, fetchedAt: '2026-11-09' }, cached).selectedByAi, true);
  const changed = applicationGuidance({ ...job, remote: true }, cached);
  assert.equal(changed.selectedByAi, false);
  assert.match(changed.questions[1], /trabajar desde Perú/);
  assert.equal(applicationGuidance({ ...job, title: 'Gerente general' }).educationId, undefined);
  assert.equal(applicationGuidance({ ...job, title: 'Ejecutivo comercial de productos SSOMA' }).skill, null);
});

test('bridge roles must be current, junior and in the same specialty and market', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const bridge = { ...job, id: 'bridge', title: 'Ayudante electricista' };
  const expired = { ...bridge, id: 'expired', validThrough: '2026-11-08' };
  const stale = { ...bridge, id: 'stale', postedAt: '2026-10-01' };
  const other = { ...bridge, id: 'other', title: 'Ayudante de voladura' };
  const abroad = { ...bridge, id: 'abroad', country: 'CL' };
  const supervisor = { ...bridge, id: 'supervisor', title: 'Supervisor electricista trainee' };
  assert.equal(experienceOpportunity(job, [job, expired, stale, other, abroad, supervisor, bridge], now)?.id, 'bridge');
  assert.equal(experienceOpportunity(bridge, [job], now), null);
  assert.equal(experienceOpportunity(job, [job, expired, stale, other, abroad, supervisor], now), null);
});
