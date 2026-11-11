import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisContext, analysisSignature, jobAnalysis, readAnalysis } from '../../src/lib/job-analysis.mjs';

const job = {
  title: 'Auditor Interno', company: 'Compañía de Minas Buenaventura', country: 'PE',
  description: '<p>Ejecutar pruebas de controles.</p><p>Elaborar informes de auditoría.</p>',
};
const context = analysisContext(job);
const analysis = {
  skills: [
    { evidence: 'pruebas de controles', advice: 'Practica con una matriz de riesgos y conserva una muestra de los controles evaluados.' },
    { evidence: 'informes de auditoría', advice: 'Redacta un informe simulado que vincule los hallazgos con sus evidencias y recomendaciones.' },
  ],
  experience: [],
  company: null,
  visit: null,
};

test('accepts source-grounded guidance, invalidates it if the announcement or type changes', () => {
  const entry = { analysisSignature: analysisSignature(context), analysis };
  assert.deepEqual(jobAnalysis(context, entry), analysis);
  assert.equal(jobAnalysis(analysisContext({ ...job, internship: true }), entry), null);
  assert.equal(jobAnalysis(analysisContext({ ...job, description: 'Otro anuncio' }), entry), null);
  assert.match(context.datosVerificados.ubicaciones[0].dirección, /Begonias 415/);
  assert.equal(analysisContext({ ...job, country: 'CL' }).datosVerificados, null);
});

test('rejects invented evidence and generated contact links', () => {
  assert.equal(readAnalysis({ ...analysis, skills: [{ ...analysis.skills[0], evidence: 'manejo de Excel' }, analysis.skills[1]] }, context), null);
  assert.equal(readAnalysis({ ...analysis, visit: 'Para coordinar la visita, llama a selección en el número 999 999 999.' }, context), null);
  assert.equal(readAnalysis({ ...analysis, visit: 'Para coordinar la visita, escribe al correo personal recluta@example.org.' }, context), null);
});
