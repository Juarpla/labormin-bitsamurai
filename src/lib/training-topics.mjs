import { localPresentation } from './job-presentation.mjs';

// Match words from the provider's program name or syllabus and the employer's
// original title or requirements. Each related area is an explicit mapping.
export const trainingTopics = {
  extraction: { label: 'explotación minera', mining: true, match: /\b(?:explotacion minera|operaciones? mina|mineria subterranea|operador de mina)\b/, related: ['mineEngineering', 'drilling'] },
  mineEngineering: { label: 'ingeniería de minas', mining: true, match: /\b(?:ingenieria de minas|ingenier[oa] (?:intermedio de |de )?minas|practicante (?:pre )?profesional de minas|planeamiento minero|mine planning|mining engineer)\b/, related: ['extraction', 'drilling'] },
  drilling: { label: 'perforación y voladura', mining: true, match: /\b(?:perforacion de rocas|perforacion y voladura|voladuras?|blasting|perforistas?)\b/, related: ['extraction', 'mineEngineering'] },
  metallurgy: { label: 'metalurgia', mining: true, match: /\b(?:metalurgi[ac][aos]*|metalurgistas?|metallurg\w+|procesamiento de minerales)\b/, related: ['extraction'] },
  geology: { label: 'geología', mining: true, match: /\b(?:geologia|geolog[oa]s?|geotecni[ac][aos]*|geotechnical|geologist|logueo geologico)\b/, related: ['surveying'] },
  surveying: { label: 'topografía', mining: true, match: /\b(?:topografia|topograf[oa]s?|surveying|muestreo mineralogico)\b/, related: ['geology', 'extraction'] },
  homeElectrical: { label: 'instalaciones eléctricas', match: /\b(?:instalaciones? electricas? (?:domiciliarias?|residenciales?|en (?:viviendas|edificaciones))|electricidad (?:domiciliaria|residencial)|instalaciones electricas\b(?! industriales))\b/, related: ['electrical', 'electronics'] },
  electrical: { label: 'electricidad y mantenimiento eléctrico', match: /\b(?:electricistas?|electricidad|mantenimiento electrico|ingenieria electrica|ingenier[oa] electricista|electromecanica|electrical maintenance|electrician|instalaciones electricas industriales)\b/, related: ['electronics', 'instrumentation'] },
  electronics: { label: 'electrónica industrial', match: /\b(?:electronica industrial|electronica y electricidad|mantenimiento electronico|tecnic[oa] (?:titulado )?en electronica|industrial electronics|electronica(?= (?:o carreras? afines|y automatizacion)))\b/, related: ['electrical', 'instrumentation'] },
  instrumentation: { label: 'instrumentación y automatización', match: /\b(?:instrumentacion(?: industrial)?|instrumentistas?|electroinstrumentistas?|automatizacion industrial|sistemas plc|scada|plc|instrumentation|instrument technician)\b/, related: ['electronics', 'electrical'] },
  mechanics: { label: 'mantenimiento mecánico', match: /\b(?:mantenimiento mecanico|mecanica de (?:mantenimiento|produccion industrial)|mecanic[oa]s? de mantenimiento|mecatronica industrial|millwright|mechanical maintenance)\b/, related: ['equipment', 'welding'] },
  equipment: { label: 'maquinaria y equipo pesado', match: /\b(?:maquinaria pesada|equipos? pesados?|heavy equipment|operacion de maquinaria)\b/, related: ['mechanics'] },
  welding: { label: 'soldadura y metalmecánica', match: /\b(?:soldadura|soldadores?|metalmecanica|carpinteria metalica|welders?|welding)\b/, related: ['mechanics'] },
  safety: { label: 'seguridad y salud en el trabajo', match: /\b(?:ssoma|hse|hsecq|sst|iperc|salud y seguridad|seguridad y salud|seguridad (?:ocupacional|minera|industrial)|higiene (?:industrial|ocupacional)|occupational health and safety)\b/, related: ['environment'] },
  environment: { label: 'gestión ambiental', match: /\b(?:gestion ambiental|ingenieria ambiental|monitoreo ambiental|medio ambiente|cierre de minas|environmental management)\b/, related: ['safety'] },
  logistics: { label: 'almacén y logística', match: /\b(?:almacen(?:es|eros?)?|despacho de (?:mercaderia|materiales)|logistica|logistics|warehouse)\b/, related: [] },
  data: { label: 'análisis de datos', match: /\b(?:power bi|analisis de datos|analista de datos|data analys[ti]\w*)\b/, related: [] },
  computing: { label: 'soporte informático', match: /\b(?:soporte (?:tecnico |de )?informatic[oa]|soporte tecnico y computo|computacion e informatica|plataformas y servicios de tecnologias de (?:la )?informacion|it support)\b/, related: [] },
};

const normalized = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\([ao]\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const topicsIn = value => {
  const phrase = normalized(value);
  return Object.keys(trainingTopics).filter(topic => trainingTopics[topic].match.test(phrase));
};

export function topicsForProgram(title) {
  const topics = topicsIn(title);
  return topics.includes('homeElectrical') ? topics.filter(topic => topic !== 'electrical') : topics;
}

const requirementStart = /^(?:titulad[oa]|egresad[oa]|bachiller|tecnic[oa] (?:en|titulado)|profesional (?:titulado|en)|estudiantes? (?:de|en)|formacion (?:en|tecnica)|(?:conocimientos?|experiencia|manejo|dominio|certificacion) (?:en|de|con)|degree in|experience (?:in|with)|knowledge of)\b/;
const requirementsEnd = /\b(?:plazo limite de postulacion|fecha (?:limite|de cierre) de postulacion|te ofrecemos|datos personales|informacion personal|what we offer|privacy policy)\b/;
export function jobTrainingEvidence(job) {
  const title = topicsIn(job.title);
  const requirements = new Set();
  sections: for (const section of localPresentation(job.description)) {
    if (section.heading !== 'requirements' && section.heading !== 'overview') continue;
    for (const block of section.blocks) {
      const clauses = block.split(/(?<=[.!?;:])\s+|[•\n]/);
      for (const clause of clauses) {
        const text = normalized(clause);
        if (requirementsEnd.test(text)) break sections;
        if (!text || /^(?:no|sin)\b/.test(text) || (section.heading !== 'requirements' && !requirementStart.test(text))) continue;
        for (const topic of topicsIn(text)) requirements.add(topic);
      }
    }
  }
  if (!title.length && !requirements.size) return;
  return {
    title,
    requirements: [...requirements],
    location: job.country === 'PE' ? normalized(`${job.city ?? ''} ${job.locationRaw ?? ''}`) : '',
    postedAt: job.postedAt,
  };
}

export function matchTrainingJob(topics, evidence) {
  if (!evidence) return;
  const directTitle = topics.find(topic => evidence.title.includes(topic));
  const directRequirement = topics.find(topic => evidence.requirements.includes(topic));
  if (directTitle || directRequirement) {
    return { kind: 'direct', topic: directTitle ?? directRequirement, inTitle: Boolean(directTitle) };
  }
  for (const subject of topics) {
    const neighbors = trainingTopics[subject].related;
    const relatedTitle = neighbors.find(topic => evidence.title.includes(topic));
    const relatedRequirement = neighbors.find(topic => evidence.requirements.includes(topic));
    if (relatedTitle || relatedRequirement) {
      return { kind: 'related', topic: relatedTitle ?? relatedRequirement, subject, inTitle: Boolean(relatedTitle) };
    }
  }
}

const credentialPrefix = /^(?:grado de instrucci[oó]n|formaci[oó]n acad[eé]mica)\s*:\s*/i;
const credentialStart = /^(?:ingenier(?:[íi]a|[oa])\b|(?:t[eé]cnic[oa]|profesional|bachiller|egresad[oa](?:\([oa]\))?|estudiantes?)\s+(?:en|de|egresad[oa]|titulad[oa]|o bachiller)\b)/i;
const credentialEnd = /[.\s]+(?=(?:experiencia|estudios adicionales|conocimientos|otros)\b)/i;

export function trainingQualifications(description) {
  const requirements = localPresentation(description).filter(section => section.heading === 'requirements').flatMap(section => section.blocks);
  const credentials = requirements.map(block => block.replace(credentialPrefix, '').trim().split(credentialEnd, 1)[0].replace(/[. ]+$/, ''));
  const credential = credentials.find(text => text.length <= 180 && credentialStart.test(text));
  return { credential, requirements: requirements.join('\n') };
}
