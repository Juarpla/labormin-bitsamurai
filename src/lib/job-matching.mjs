import { sourceText } from './job-policy.mjs';
import { jobTrainingEvidence, topicsForProgram, trainingTopics } from './training-topics.mjs';

export const matchText = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

const subjects = {
  logistics: [/\b(?:logistic[ao]s?|almacenes?|almac[eé]n|almacener[oa]s?|abastecimiento|cadena de suministro|inventarios?|despachos?|compras|warehouse|supply chain)\b/i, 'almacén y abastecimiento'],
  spreadsheets: [/\b(?:excel|hojas de c[aá]lculo)\b/i, 'Excel y hojas de cálculo'],
  office: [/\b(?:microsoft office|ms office|office)\b/i, 'herramientas de Office'],
  finance: [/\b(?:tesorer[ií]a|contabilidad|contable|finanzas|costos y presupuestos)\b/i, 'contabilidad y finanzas'],
  people: [/\b(?:recursos humanos|bienestar social|administraci[oó]n de personal|desarrollo humano|rrhh)\b/i, 'gestión de personal'],
  quality: [/\b(?:mejora continua|control de calidad|gesti[oó]n de calidad|mejora y control de procesos)\b/i, 'calidad y mejora de procesos'],
  industrial: [/\bingenier[ií]a industrial\b/i, 'ingeniería industrial'],
  contracts: [/\b(?:gesti[oó]n de contratistas|administraci[oó]n de contratos|contrataciones)\b/i, 'gestión de contratos'],
};

export function roleTopics(job) {
  const evidence = jobTrainingEvidence(job);
  const text = sourceText(job.description);
  const title = new Set(evidence?.title ?? []);
  const requirements = new Set(evidence?.requirements ?? []);
  for (const [key, [pattern]] of Object.entries(subjects)) {
    if (pattern.test(job.title)) title.add(key);
    else if (pattern.test(text)) requirements.add(key);
  }
  return { title: [...title], requirements: [...requirements] };
}

export function programTopics(text) {
  return [...new Set([...topicsForProgram(text), ...Object.entries(subjects).flatMap(([key, [pattern]]) => pattern.test(text) ? [key] : [])])];
}

export function trainingOverlap(job, program) {
  const topics = programTopics(program);
  const direct = job.title.filter(topic => topics.includes(topic));
  const supported = job.requirements.filter(topic => topics.includes(topic));
  if (!supported.includes('spreadsheets') && job.requirements.includes('office') && topics.includes('spreadsheets')) {
    supported.push('spreadsheets');
  }
  return { direct, supported };
}

export function topicLabel(id) {
  return subjects[id]?.[1] ?? trainingTopics[id]?.label ?? null;
}
