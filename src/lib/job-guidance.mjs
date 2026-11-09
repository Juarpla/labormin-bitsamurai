import { createHash } from 'node:crypto';
import { isExpired } from './job-policy.mjs';

const skills = {
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
  return job.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
