import test from 'node:test';
import assert from 'node:assert/strict';
import { jobWorksite } from '../../src/lib/job-worksite.mjs';

test('surfaces a documented work region that differs from the job board city', () => {
  const job = {
    country: 'PE', city: 'Lima',
    description: '<p>Disponibilidad para realizar prácticas presenciales bajo régimen minero en Cusco.</p>',
  };
  assert.deepEqual(jobWorksite(job), {
    region: 'Cusco', conflicting: true, roster: undefined, mineRoster: true,
    location: undefined, campCoverage: false,
  });
  assert.equal(jobWorksite({ ...job, city: 'Cusco' }).conflicting, false);
});

test('resolves a named operation from an explicit posting location and official employer data', () => {
  const job = { country: 'PE', city: 'Arequipa', company: 'Hochschild' };
  const offer = jobWorksite({
    ...job,
    description: 'Ubicación: Unidad Minera Inmaculada Modalidad: Régimen 14x7. Cobertura de traslados desde determinadas ciudades, alojamiento y alimentación al 100%.',
  });
  assert.equal(offer.region, 'Ayacucho');
  assert.equal(offer.location.name, 'Unidad Minera Inmaculada');
  assert.equal(offer.conflicting, true);
  assert.equal(offer.campCoverage, true);
  assert.equal(jobWorksite({ ...job, description: 'Experiencia previa en Unidad Minera Inmaculada.' }).region, undefined);
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
