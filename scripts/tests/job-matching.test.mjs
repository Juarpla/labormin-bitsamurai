import test from 'node:test';
import assert from 'node:assert/strict';
import { roleTopics, trainingOverlap } from '../../src/lib/job-matching.mjs';
import { publishedRole } from '../../src/lib/job-role.mjs';

test('matches both logistics courses and spreadsheet training supported by Office', () => {
  const role = {title: 'Practicante Profesional de Logística', description: 'Requisitos: Manejo de Office a nivel intermedio.'};
  const evidence = roleTopics(role);
  assert.deepEqual(trainingOverlap(evidence, 'Almacén, despacho y reposición de mercadería').direct, ['logistics']);
  assert.deepEqual(trainingOverlap(evidence, 'Excel intermedio').supported, ['spreadsheets']);
  assert.deepEqual(trainingOverlap(evidence, 'Introducción a la gastronomía'), { direct: [], supported: [] });
});

test('extracts original responsibilities from a flattened announcement', () => {
  const role = publishedRole({title: 'Practicante de Logística', description:
    '<p>Perfil.Responsabilidades:- Apoyar la recepción de materiales.- Dar seguimiento a las órdenes de compra.Requisitos:- Manejo de Office.</p>'});
  assert.deepEqual(role.tasks, ['Apoyar la recepción de materiales.', 'Dar seguimiento a las órdenes de compra.']);
});
