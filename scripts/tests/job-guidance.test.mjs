import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applicationGuidance, experienceOpportunity, guidanceContext, guidanceMessages,
  careerGuidance, careerGuidanceContext, careerGuidanceMessages, careerGuidanceSignature, validCareerGuidance,
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


test('career guidance ranks only catalog entries with published junior experience', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const role = { ...job, title: 'Ingeniero(a) Minas – Mediano Plazo', description: '5 años de experiencia en planes de minado.' };
  const candidate = { ...job, title: 'Practicante Profesional de Planeamiento - Mina', internship: true };
  const options = [
    { ...candidate, id: 'unknown', description: 'Convenio con la universidad.' },
    { ...candidate, id: 'mixed', description: '3 meses de prácticas preprofesionales. Experiencia mínima de 3 años.' },
    { ...candidate, id: 'zero', description: 'No se requiere experiencia previa.' },
    { ...candidate, id: 'six', company: 'Another mine', description: 'Experiencia mínima de 6 meses.' },
    { ...candidate, id: 'expired', validThrough: '2026-11-08', description: 'No se requiere experiencia.' },
  ];
  const context = careerGuidanceContext(role, options, now);
  assert.deepEqual(context.opportunities.map(({ job, experience }) => [job.id, experience.months]), [['zero', 0], ['six', 6]]);
  assert.equal(careerGuidance(context).trainingIds.length, 2);
  assert.doesNotMatch(JSON.stringify(careerGuidanceMessages(context)), /Convenio con la universidad|Ingeniero\(a\)/);
  const entry = {
    careerSignature: careerGuidanceSignature(context),
    tipId: 'planning', questionIds: ['planning-evidence', 'placement'],
    trainingIds: [...context.trainingIds].reverse(), opportunityIds: ['six', 'zero'],
  };
  assert.equal(validCareerGuidance(entry, context), true);
  assert.equal(validCareerGuidance({ ...entry, opportunityIds: ['six', 'expired'] }, context), false);
  assert.deepEqual(careerGuidance(context, entry).opportunities.map(item => item.job.id), ['six', 'zero']);
});

test('an environmental permits internship recommends distinct current entry opportunities without changing training', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const permits = { ...job, title: 'Practicante de Licencias y Permisos', company: 'Minera Chinalco', internship: true };
  const practice = { ...job, id: 'environment', title: 'Practicante Profesional de Medio Ambiente', internship: true };
  const junior = { ...job, id: 'closure', title: 'Environmental Mine Closure Engineer, Junior', description: 'A partir un año de experiencia en consultoría.' };
  const context = careerGuidanceContext(permits, [
    permits,
    { ...permits, id: 'duplicate', company: 'Minera Chinalco Perú' },
    { ...practice, id: 'expired', validThrough: '2026-11-08' },
    { ...practice, id: 'unrelated', title: 'Practicante de Geología' },
    { ...practice, id: 'senior', title: 'Supervisor de cierre de mina', description: '5 años de experiencia.' },
    { ...practice, id: 'requires-two-years', title: 'Practicante de Gestión Ambiental', description: '2 años de experiencia.' },
    junior,
    practice,
    { ...practice, id: 'environment-duplicate', postedAt: '2026-11-03' },
  ], now);
  const guide = careerGuidance(context);
  assert.equal(guide.experienceSkill, 'gestión ambiental minera');
  assert.deepEqual(guide.trainingIds, []);
  assert.deepEqual(guide.opportunities.map(({ job, experience }) => [job.id, experience?.months ?? null]), [
    ['closure', 12],
    ['environment', null],
  ]);
});

test('career guidance expands training with options near the vacancy', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const role = { ...job, locationRaw: 'Morococha, Junín, Peru', city: 'Morococha' };
  const context = careerGuidanceContext(role, [], now);
  // la afinidad de la especialidad sigue primero
  assert.deepEqual(context.trainingIds.slice(0, 3), ['promae-comas', 'cetpro-juliaca', 'jose-carlos-mariategui']);
  // y se amplía con opciones del departamento de la vacante (Junín)
  assert.ok(context.trainingIds.includes('la-oroya'), 'instituto de Junín en la lista');
  assert.ok(context.trainingIds.includes('cetpro-san-ramon-junin'), 'CETPRO de Junín en la lista');
  assert.ok(context.trainingIds.length <= 8);
  // fuera de Perú no se amplía por geografía
  const foreign = careerGuidanceContext({ ...role, country: 'CL', locationRaw: 'Santiago, Chile' }, [], now);
  assert.equal(foreign.trainingIds.includes('la-oroya'), false);
  // sin ubicación no se amplía
  assert.equal(careerGuidanceContext(job, [], now).trainingIds.length, 3);
});

test('career guidance always offers two distinct tips without changing cached selections', () => {
  const context = careerGuidanceContext({ ...job, title: 'Puesto general', description: 'Funciones generales' }, [], new Date('2026-11-09T12:00:00Z'));
  const result = careerGuidance(context);
  assert.equal(result.tips.length, 2);
  assert.notEqual(result.tips[0], result.tips[1]);
});
