import test from 'node:test';
import assert from 'node:assert/strict';
import { jobWorksite } from '../../src/lib/job-worksite.mjs';

test('surfaces a documented work region that differs from the job board city', () => {
  const job = {
    country: 'PE', city: 'Lima',
    description: '<p>Disponibilidad para realizar prácticas presenciales bajo régimen minero en Cusco.</p>',
  };
  assert.deepEqual(jobWorksite(job), { region: 'Cusco', conflicting: true, roster: undefined, mineRoster: true });
  assert.equal(jobWorksite({ ...job, city: 'Cusco' }).conflicting, false);
});

test('does not infer a worksite from residence, negation or conflicting mentions', () => {
  const job = { country: 'PE', city: 'Lima' };
  for (const description of [
    'Residir en Cusco.',
    'No se realiza trabajo en Cusco.',
    'Puesto en Cusco. Trabajo presencial en Lima.',
  ]) assert.equal(jobWorksite({ ...job, description }).region, undefined);
  assert.equal(jobWorksite({ ...job, description: 'Régimen 14x7.' }).roster, '14x7');
});
