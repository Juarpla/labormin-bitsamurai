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

const tips = {
  planning: 'Lleva un ejemplo de un plan de minado y explica qué decisiones tomaste con los datos disponibles.',
  software: 'Elige una herramienta mencionada en el anuncio y prepara un ejemplo concreto de cómo la usaste.',
  equipment: 'Prepara un ejemplo de trabajo con los equipos que menciona la vacante y cuenta qué resultado obtuviste.',
  safety: 'Prepara un ejemplo de cómo identificaste un riesgo y qué medidas tomaste antes de iniciar el trabajo.',
  experience: 'Relaciona la experiencia que pide el anuncio con un proyecto concreto y describe tu aporte.',
  role: 'Elige una tarea del anuncio y prepara un ejemplo que muestre cómo la abordarías.',
};

const entryRole = /\b(?:practicante|trainee|becari[oa]|auxiliar|ayudante|asistente|junior|jr)\b/;
const seniorRole = /\b(?:jefe|gerente|senior|supervisor|coordinador|administrativ[oa])\b/;
const numericExperience = /(?:\bexperiencia\s+(?:(?:m[ií]nima|previa|deseable)\s+)?(?:de\s+)?(?:(?:al menos|entre)\s+)?(\d+)(?:\s*(?:a|y|–|-)\s*(\d+))?\s+(años?|mes(?:es)?)|(\d+)(?:\s*(?:a|y|–|-)\s*(\d+))?\s+(años?|mes(?:es)?)\s+(?:de\s+)?(?:experiencia|pr[aá]cticas?\s+preprofesionales))/giu;

export function publishedExperience(job) {
  const text = sourceText(job.description).replace(/\s+/g, ' ');
  const mentions = [...text.matchAll(numericExperience)].map(match => {
    const upper = Number(match[2] ?? match[5] ?? match[1] ?? match[4]);
    return { text: match[0], months: upper * (/^año/i.test(match[3] ?? match[6]) ? 12 : 1) };
  });
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
  const trainingIds = skill?.training ?? trainingBySkill[base.skillId] ?? [];
  const opportunities = [];
  if (base.skillId && !entryRole.test(titleOf(job))) {
    for (const candidate of jobs) {
      if (candidate.id === job.id || candidate.country !== job.country || candidate.remote !== job.remote ||
          skillFor(candidate) !== base.skillId || !isCurrentGuidanceJob(candidate, now)) continue;
      const title = titleOf(candidate);
      if ((!candidate.internship && !entryRole.test(title)) || seniorRole.test(title)) continue;
      const experience = publishedExperience(candidate);
      if (experience && experience.months <= 12) opportunities.push({ job: candidate, experience });
    }
  }
  opportunities.sort((a, b) => a.experience.months - b.experience.months || b.job.postedAt.localeCompare(a.job.postedAt));
  return { ...base, tipIds, trainingIds, opportunities: opportunities.slice(0, 8) };
}

export function careerGuidanceSignature(context) {
  return createHash('sha256').update(JSON.stringify([
    2, guidanceSignature(context), context.tipIds, context.trainingIds,
    context.opportunities.map(({ job, experience }) => [job.id, experience.months]),
  ])).digest('hex');
}

export function careerGuidanceMessages(context) {
  const catalog = context.trainingIds.map(id => {
    const item = trainingRecords.find(record => record.id === id);
    return { id, programa: item.program, duracion: item.duration };
  });
  return [
    { role: 'system', content: 'Prioriza orientación para una vacante en Labormin. Devuelve solo JSON con tipId (uno disponible), questionIds (dos distintos, al menos uno técnico si está disponible), trainingIds (todos los disponibles ordenados), opportunityIds (hasta tres disponibles ordenados). Usa solo IDs proporcionados. Prioriza experiencia inicial y formación que cubra la especialidad. Usa arreglos vacíos si no hay candidatos.' },
    { role: 'user', content: JSON.stringify({
      especialidad: context.skill,
      tips: context.tipIds.map(id => ({ id, texto: tips[id] })),
      preguntas: context.options.map(id => ({ id, texto: questions[id] })),
      formacion: catalog,
      experiencia: context.opportunities.map(({ job, experience }) => ({ id: job.id, meses: experience.months, practica: Boolean(job.internship) })),
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
  const opportunities = selected
    ? entry.opportunityIds.map(id => context.opportunities.find(item => item.job.id === id))
    : context.opportunities.slice(0, 3);
  return {
    skill: context.skill,
    tip: tips[selected ? entry.tipId : context.tipIds[0]],
    questions: (selected ? entry.questionIds : context.fallback).map(id => questions[id]),
    trainingIds: selected ? entry.trainingIds : context.trainingIds,
    opportunities,
  };
}
