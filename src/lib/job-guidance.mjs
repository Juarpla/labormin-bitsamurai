import { createHash } from 'node:crypto';
import trainingRecords from '../data/education.json' with { type: 'json' };
import { isExpired, sourceText } from './job-policy.mjs';

const skills = {
  'mine-planning': {
    label: 'planeamiento minero',
    title: /\b(?:ingenier[oa] (?:intermedio de |de )?minas|practicante profesional de minas|planeamiento.{0,25}(?:mina|minera)|planificacion minera)\b/,
    questions: ['planning-evidence', 'mine-tasks'],
    training: ['narciso-villanueva', 'chalhuahuacho'],
  },
  'industrial-electronics': {
    label: 'electrónica industrial',
    title: /\belectronica industrial\b/,
    questions: ['equipment', 'technical-evidence'],
    education: 'jose-carlos-mariategui',
  },
  electrical: {
    label: 'electricidad',
    title: /\b(?:electricistas?|electroinstrumentistas?|mantenimiento electrico|instalaciones electricas|ingenieria electrica|ingenier[oa] electricista)\b/,
    questions: ['equipment', 'technical-evidence'],
    education: 'cetpro-juliaca',
  },
  'mechanical-maintenance': {
    label: 'mantenimiento mecánico',
    title: /\b(?:mantenimiento mecanico|mecanic[oa]s? de mantenimiento)\b/,
    questions: ['equipment', 'technical-evidence'],
  },
  hydraulics: {
    label: 'hidráulica',
    title: /\b(?:hidraulic[oa]s?|oleohidraulic[oa]s?)\b/,
    questions: ['equipment', 'technical-evidence'],
  },
  safety: {
    label: 'seguridad y salud en el trabajo',
    title: /\b(?:ssoma|hse|hsecq|sst|seguridad y salud ocupacional|seguridad y salud en el trabajo)\b/,
    questions: ['site-safety', 'technical-evidence'],
    education: 'capacita-t',
  },
  geology: {
    label: 'geología',
    title: /\b(?:geologia|geolog[oa]s?|logueo geologico)\b/,
    questions: ['geology-tasks', 'technical-evidence'],
  },
  blasting: {
    label: 'voladura',
    title: /\b(?:voladura|blasting)\b/,
    questions: ['blasting-tasks', 'technical-evidence'],
  },
  mining: {
    label: 'explotación minera',
    title: /\bexplotacion minera\b/,
    questions: ['mine-tasks', 'site-safety'],
    education: 'narciso-villanueva',
  },
};

const questions = {
  'planning-evidence': '¿Qué horizontes de planeamiento y herramientas se usan en esta operación?',
  equipment: '¿Con qué equipos o sistemas se trabaja y qué experiencia concreta debo acreditar con ellos?',
  'technical-evidence': '¿Qué experiencia o certificación es obligatoria y qué evidencia aceptan para acreditarla?',
  'site-safety': '¿Qué inducción o certificaciones de seguridad piden antes de ingresar a la operación?',
  'geology-tasks': '¿El puesto se centra en campo, logueo, muestreo o análisis, y qué herramientas debo manejar?',
  'blasting-tasks': '¿Qué tareas de voladura realizaría y qué autorizaciones o experiencia son obligatorias?',
  'mine-tasks': '¿Qué labores de mina asumiría y qué parte del trabajo se realiza en campo?',
  placement: '¿En qué operación o sede se realiza el trabajo, cuál es el régimen y quién cubre el traslado?',
  remote: '¿Puedo trabajar desde Perú y qué entidad, horario y modalidad de contratación aplican?',
  'salary-published': '¿La remuneración indicada es bruta o neta y qué pagos corresponden a bonos o viáticos?',
  'salary-missing': '¿Cuál es el rango de sueldo base y cómo se pagan los bonos o viáticos, si corresponden?',
  internship: '¿La práctica acepta estudiantes o egresados y qué convenio o constancia debo presentar?',
  visa: '¿Qué permiso de trabajo aplica y qué apoyo, si lo hay, ofrece el empleador?',
};

function titleOf(job) {
  return job.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([ao]\)/g, '');
}

function skillFor(job) {
  const title = titleOf(job);
  if (/\b(?:ejecutiv[oa] comercial|asesor[a]? comercial|vendedor[a]?|ventas)\b/.test(title)) return undefined;
  return Object.entries(skills).find(([, skill]) => skill.title.test(title))?.[0];
}

export function guidanceContext(job) {
  const skillId = skillFor(job);
  const skill = skillId ? skills[skillId] : null;
  const practical = job.internship ? ['internship'] : [];
  const logistics = job.remote ? 'remote' : 'placement';
  const visa = job.country !== 'PE' && !job.remote ? ['visa'] : [];
  const compensation = job.salary ? 'salary-published' : 'salary-missing';
  const options = [...practical, ...(skill?.questions ?? []), ...visa, logistics, compensation];

  return {
    skillId,
    skill: skill?.label ?? null,
    options,
    fallback: skill && !job.internship ? [options[0], visa[0] ?? logistics] : options.slice(0, 2),
  };
}

export function guidanceSignature(context) {
  const options = context.options.map(id => [id, questions[id]]);
  return createHash('sha256').update(JSON.stringify([1, context.skill, options])).digest('hex');
}

export function validGuidanceQuestions(ids, context) {
  const required = context.skillId ? skills[context.skillId].questions : [];
  return Array.isArray(ids) && ids.length === 2 && ids[0] !== ids[1] &&
    ids.every(id => typeof id === 'string' && context.options.includes(id)) &&
    ids.some(id => required.includes(id));
}

export function guidanceMessages(context) {
  // Only Labormin's controlled topic and question catalog leave the repository.
  return [
    {
      role: 'system',
      content: 'Elige exactamente dos preguntas útiles y distintas para un postulante. Al menos una debe corresponder a la especialidad técnica. Usa únicamente los identificadores disponibles. Devuelve JSON con la propiedad questionIds y ningún otro texto.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        especialidad: context.skill,
        preguntas: context.options.map(id => ({ id, texto: questions[id] })),
      }),
    },
  ];
}

export function applicationGuidance(job, entry) {
  const context = guidanceContext(job);
  const selected = entry && entry.signature === guidanceSignature(context) &&
    validGuidanceQuestions(entry.questionIds, context);
  const skill = context.skillId ? skills[context.skillId] : null;
  return {
    questions: (selected ? entry.questionIds : context.fallback).map(id => questions[id]),
    skill: skill?.label ?? null,
    educationId: job.country === 'PE' ? skill?.education : undefined,
    selectedByAi: Boolean(selected),
  };
}

export function isCurrentGuidanceJob(job, now) {
  const postedAt = Date.parse(job.postedAt);
  return postedAt >= now.getTime() - 30 * 86400000 &&
    postedAt <= now.getTime() + 86400000 && !isExpired(job, now);
}

export function experienceOpportunity(job, jobs, now = new Date()) {
  const skillId = skillFor(job);
  const title = titleOf(job);
  const entryRole = /\b(?:practicante|trainee|becari[oa]|auxiliar|ayudante)\b/;
  const unrelatedRole = /\b(?:supervisor|jefe|gerente|senior|coordinador|digitalizacion|documentari[oa]|administrativ[oa])\b/;
  if (!skillId || job.internship || entryRole.test(title)) return null;

  return jobs.find(candidate => {
    if (candidate.id === job.id || candidate.country !== job.country || candidate.remote !== job.remote) return false;
    const candidateTitle = titleOf(candidate);
    return !unrelatedRole.test(candidateTitle) && (candidate.internship || entryRole.test(candidateTitle)) &&
      skillFor(candidate) === skillId && isCurrentGuidanceJob(candidate, now);
  }) ?? null;
}


const trainingBySkill = {
  electrical: ['promae-comas', 'cetpro-juliaca', 'jose-carlos-mariategui'],
  'industrial-electronics': ['jose-carlos-mariategui', 'cetpro-juliaca'],
  'mechanical-maintenance': ['chalhuahuacho'],
  safety: ['capacita-t'],
  mining: ['narciso-villanueva', 'chalhuahuacho'],
};

// Cercanía geográfica: amplía la formación recomendada con opciones del mismo
// departamento que la vacante (solo Perú; la fuente es education.json).
const normalizeText = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function geoTrainingIds(job) {
  if (job.country !== 'PE') return [];
  const hay = normalizeText(`${job.locationRaw ?? ''} ${job.city ?? ''}`).trim();
  if (!hay) return [];
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = trainingRecords.filter((record) => {
    const department = record.location.split('·').pop().trim();
    return new RegExp(`\\b${escape(normalizeText(department))}\\b`).test(hay);
  });
  const carreras = matches.filter((record) => record.group === 'carreras').slice(0, 3);
  const cetpros = matches.filter((record) => record.group === 'oficios').slice(0, 1);
  return [...carreras, ...cetpros].map((record) => record.id);
}

const tips = {
  planning: 'Lleva un ejemplo de un plan de minado y explica qué decisiones tomaste con los datos disponibles.',
  software: 'Elige una herramienta mencionada en el anuncio y prepara un ejemplo concreto de cómo la usaste.',
  equipment: 'Prepara un ejemplo de trabajo con los equipos que menciona la vacante y cuenta qué resultado obtuviste.',
  safety: 'Prepara un ejemplo de cómo identificaste un riesgo y qué medidas tomaste antes de iniciar el trabajo.',
  experience: 'Relaciona la experiencia que pide el anuncio con un proyecto concreto y describe tu aporte.',
  role: 'Elige una tarea del anuncio y prepara un ejemplo que muestre cómo la abordarías.',
};

const entryRole = /\b(?:practicante|trainee|becari[oa]|auxiliar|ayudante|asistente|junior|jr)\b/;
const practiceRole = /\b(?:practicantes?|practicas?|interns?|internship|becari[oa]s?)\b/;
const seniorRole = /\b(?:jefe|gerente|senior|supervisor|coordinador|administrativ[oa])\b/;
const numericExperience = /(?:\bexperiencia\s+(?:(?:m[ií]nima|previa|deseable)\s+)?(?:de\s+)?(?:(?:al menos|entre)\s+)?(\d+)(?:\s*(?:a|y|–|-)\s*(\d+))?\s+(años?|mes(?:es)?)|(\d+)(?:\s*(?:a|y|–|-)\s*(\d+))?\s+(años?|mes(?:es)?)\s+(?:de\s+)?(?:experiencia|pr[aá]cticas?\s+preprofesionales))/giu;
const singleYearExperience = /\b(?:un año de experiencia|experiencia (?:m[ií]nima )?de un año)\b/giu;

function experienceAreaFor(job) {
  const title = titleOf(job);
  if (/\b(?:licencias y permisos|permisos ambientales|gestion ambiental|medio ambiente|cierre de minas?|environmental mine closure)\b/.test(title)) {
    return 'environmental-management';
  }
  return skillFor(job);
}

function opportunityKey(job) {
  const company = (job.companySlug || job.company).toLowerCase().replace(/[- ]per[uú]$/, '');
  const title = titleOf(job).replace(/[^a-z0-9]+/g, ' ').trim();
  return `${company}:${title}:${job.city ?? ''}`;
}

export function publishedExperience(job) {
  const text = sourceText(job.description).replace(/\s+/g, ' ');
  const mentions = [...text.matchAll(numericExperience)].map(match => {
    const upper = Number(match[2] ?? match[5] ?? match[1] ?? match[4]);
    return { text: match[0], months: upper * (/^año/i.test(match[3] ?? match[6]) ? 12 : 1) };
  });
  for (const match of text.matchAll(singleYearExperience)) mentions.push({ text: match[0], months: 12 });
  if (mentions.length) return mentions.reduce((a, b) => a.months >= b.months ? a : b);
  const none = text.match(/\b(?:sin experiencia (?:previa|laboral)|no (?:se )?(?:requiere|exige) experiencia(?: previa| laboral)?|no es necesaria (?:la )?experiencia)\b/i);
  return none ? { text: none[0], months: 0 } : null;
}

export function careerGuidanceContext(job, jobs, now = new Date()) {
  const base = guidanceContext(job);
  const text = sourceText(job.description);
  const skill = skills[base.skillId];
  const tipIds = [
    ...(base.skillId === 'mine-planning' && /plan(?:es)? de minado|planeamiento/i.test(text) ? ['planning'] : []),
    ...(/\b(?:autocad|mineplan|deswik|surpac|sap|excel)\b/i.test(text) ? ['software'] : []),
    ...(skill?.questions.includes('equipment') ? ['equipment'] : []),
    ...(base.skillId === 'safety' ? ['safety'] : []),
    ...(publishedExperience(job)?.months > 0 ? ['experience'] : []),
    'role',
  ];
  const baseTraining = skill?.training ?? trainingBySkill[base.skillId] ?? [];
  const trainingIds = [...new Set([...baseTraining, ...geoTrainingIds(job)])].slice(0, 8);
  const experienceArea = experienceAreaFor(job);
  const experienceSkill = experienceArea === 'environmental-management' ? 'gestión ambiental minera' : base.skill;
  const isPractice = practiceRole.test(titleOf(job));
  const currentKey = opportunityKey(job);
  const opportunities = [];
  if (experienceArea) {
    for (const candidate of jobs) {
      if (candidate.id === job.id || candidate.country !== job.country || candidate.remote !== job.remote ||
          experienceAreaFor(candidate) !== experienceArea || !isCurrentGuidanceJob(candidate, now) ||
          opportunityKey(candidate) === currentKey) continue;
      const title = titleOf(candidate);
      const candidateIsPractice = practiceRole.test(title);
      if ((!candidate.internship && !candidateIsPractice && !entryRole.test(title)) || seniorRole.test(title)) continue;
      const experience = publishedExperience(candidate);
      if (experience && experience.months <= 12) opportunities.push({ job: candidate, experience });
      if (!experience && isPractice && candidateIsPractice) opportunities.push({ job: candidate, experience: null });
    }
  }
  opportunities.sort((a, b) => (a.experience?.months ?? 13) - (b.experience?.months ?? 13) ||
    b.job.postedAt.localeCompare(a.job.postedAt));
  const seen = new Set();
  const uniqueOpportunities = opportunities.filter(({ job: candidate }) => {
    const key = opportunityKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...base, tipIds, trainingIds, experienceSkill, opportunities: uniqueOpportunities.slice(0, 8) };
}

export function careerGuidanceSignature(context) {
  return createHash('sha256').update(JSON.stringify([
    2, guidanceSignature(context), context.tipIds, context.trainingIds,
    context.opportunities.map(({ job, experience }) => [job.id, experience?.months ?? null]),
  ])).digest('hex');
}

export function careerGuidanceMessages(context) {
  const catalog = context.trainingIds.map(id => {
    const item = trainingRecords.find(record => record.id === id);
    return { id, programa: item.program, duracion: item.duration };
  });
  return [
    { role: 'system', content: 'Prioriza orientación para una vacante en Labormin. Devuelve solo JSON con tipId (uno disponible), questionIds (dos distintos, al menos uno técnico si está disponible), trainingIds (todos los disponibles ordenados), opportunityIds (hasta tres disponibles ordenados). Usa solo IDs proporcionados. Prioriza experiencia inicial y formación que cubra la especialidad; considera también la cercanía geográfica de la formación a la ubicación de la vacante. Usa arreglos vacíos si no hay candidatos.' },
    { role: 'user', content: JSON.stringify({
      especialidad: context.skill,
      tips: context.tipIds.map(id => ({ id, texto: tips[id] })),
      preguntas: context.options.map(id => ({ id, texto: questions[id] })),
      formacion: catalog,
      experiencia: context.opportunities.map(({ job, experience }) => ({ id: job.id, meses: experience?.months ?? null, practica: Boolean(job.internship) })),
    }) },
  ];
}

export function validCareerGuidance(entry, context) {
  const allowedList = (ids, allowed, count) => Array.isArray(ids) && ids.length === count &&
    new Set(ids).size === count && ids.every(id => allowed.includes(id));
  return context.tipIds.includes(entry?.tipId) &&
    allowedList(entry?.questionIds, context.options, 2) &&
    (!context.skillId || validGuidanceQuestions(entry.questionIds, context)) &&
    allowedList(entry?.trainingIds, context.trainingIds, context.trainingIds.length) &&
    allowedList(entry?.opportunityIds, context.opportunities.map(item => item.job.id), Math.min(3, context.opportunities.length));
}

export function careerGuidance(context, entry) {
  const selected = entry?.careerSignature === careerGuidanceSignature(context) && validCareerGuidance(entry, context);
  const hasPracticeQuestions = context.options.includes('internship') &&
    entry?.signature === guidanceSignature(context) && validGuidanceQuestions(entry.questionIds, context);
  const opportunities = selected
    ? entry.opportunityIds.map(id => context.opportunities.find(item => item.job.id === id))
    : context.opportunities.slice(0, 3);
  return {
    skill: context.skill,
    tip: tips[selected ? entry.tipId : context.tipIds[0]],
    questions: (selected || hasPracticeQuestions ? entry.questionIds : context.fallback).map(id => questions[id]),
    trainingIds: selected ? entry.trainingIds : context.trainingIds,
    experienceSkill: context.experienceSkill,
    opportunities,
  };
}
