import assert from 'node:assert/strict';
import test from 'node:test';
import { jobTrainingEvidence, matchTrainingJob, topicsForProgram, trainingQualifications } from '../../src/lib/training-topics.mjs';

const evidence = (title, description) => jobTrainingEvidence({ title, description, country: 'PE', postedAt: '2026-11-12' });

test('training matches specialties in the original title or requirements and labels related areas', () => {
  const topics = topicsForProgram('Electrónica Industrial');
  const direct = evidence('Técnico de planta', '<h3>Requisitos</h3><p>Titulado en Electrónica Industrial.</p>');
  assert.deepEqual(matchTrainingJob(topics, direct), { kind: 'direct', topic: 'electronics', inTitle: false });
  const related = evidence('Técnico instrumentista', '<p>Realizar mantenimiento.</p>');
  assert.deepEqual(matchTrainingJob(topics, related), { kind: 'related', topic: 'instrumentation', subject: 'electronics', inTitle: true });
});

test('company boilerplate and electronic contact details do not create a program match', () => {
  const listing = evidence('Practicante de Metalurgia', '<p>Empresa comprometida con la seguridad y salud ocupacional.</p>' +
    '<p>Requisitos:</p><p>Egresado de Ingeniería Metalúrgica.</p><p>Te ofrecemos beneficios.</p>' +
    '<p>Consulta los datos personales en la dirección electrónica indicada.</p>');
  assert.equal(matchTrainingJob(['electronics'], listing), undefined);
  assert.equal(matchTrainingJob(['safety'], listing), undefined);
});

test('training displays employer qualifications and ignores years of company experience', () => {
  const description = '<p>Somos una empresa con 35 años de experiencia.</p><h3>Requisitos</h3>' +
    '<p>Ingeniero Mecánico o Mecatrónico (titulado). Experiencia mínima de 5 años.</p>';
  const { credential, requirements } = trainingQualifications(description);
  assert.equal(credential, 'Ingeniero Mecánico o Mecatrónico (titulado)');
  assert.match(requirements, /Experiencia mínima de 5 años/);
  assert.doesNotMatch(requirements, /35 años/);
  for (const title of ['Titulado o Bachiller en Ingeniería Mecánica', 'Técnico Mecánico, electromecánico en áreas afines']) {
    assert.equal(trainingQualifications(`<h3>Requisitos</h3><p>${title}.</p>`).credential, title);
  }
});
