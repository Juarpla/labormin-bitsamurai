import { decodeHTML } from 'entities';
import { sourceText } from './job-policy.mjs';
import { trainingTopics } from './training-topics.mjs';

// Explain the connection without implying that a credential is equivalent.
const sharedWork = {
  extraction: { mineEngineering: 'planeamiento y operación de mina', drilling: 'perforación como parte del ciclo de extracción' },
  mineEngineering: { extraction: 'planeamiento y operación de mina', drilling: 'diseño y control de perforación y voladura' },
  drilling: { extraction: 'perforación como parte del ciclo de extracción', mineEngineering: 'diseño y control de perforación y voladura' },
  metallurgy: { extraction: 'muestreo y control del mineral antes del procesamiento' },
  geology: { surveying: 'levantamiento de terreno y ubicación de muestras' },
  surveying: { geology: 'levantamiento de terreno y ubicación de muestras', extraction: 'medición del avance y de los volúmenes extraídos' },
  homeElectrical: { electrical: 'lectura de planos y comprobación de circuitos', electronics: 'medición eléctrica y diagnóstico de circuitos' },
  electrical: { electronics: 'diagnóstico de tableros y circuitos de control', instrumentation: 'lectura de señales y diagnóstico de equipos de control' },
  electronics: { electrical: 'diagnóstico de tableros y circuitos de control', instrumentation: 'sensores y control de procesos' },
  instrumentation: { electronics: 'sensores y control de procesos', electrical: 'lectura de señales y diagnóstico de equipos de control' },
  mechanics: { equipment: 'inspección y mantenimiento de equipos', welding: 'reparación de componentes y estructuras' },
  equipment: { mechanics: 'inspección y mantenimiento de equipos' },
  welding: { mechanics: 'reparación de componentes y estructuras' },
  safety: { environment: 'identificación de riesgos y control en campo' },
  environment: { safety: 'identificación de riesgos y control en campo' },
};

const miningSignals = /\b(?:planes? de minado|planeamiento minero|geomec[aá]nica|sostenimiento|ventilaci[oó]n|perforaci[oó]n|voladura|reconciliaci[oó]n de producci[oó]n|muestreo)\b/gi;
const electricalSignals = /\b(?:sensores|sistemas plc|scada|tableros|protecciones el[eé]ctricas|automatizaci[oó]n industrial)\b/gi;
const mechanicalSignals = /\b(?:mantenimiento preventivo|mantenimiento correctivo|equipos pesados|soldadura)\b/gi;
const signalsByTopic = {
  extraction: miningSignals, mineEngineering: miningSignals, drilling: miningSignals, metallurgy: miningSignals,
  geology: /\b(?:logueo|cartograf[ií]a geol[oó]gica|hidrogeolog[ií]a|geotecnia|muestreo)\b/gi,
  surveying: /\b(?:levantamiento topogr[aá]fico|muestreo|topograf[ií]a)\b/gi,
  homeElectrical: electricalSignals, electrical: electricalSignals, electronics: electricalSignals, instrumentation: electricalSignals,
  mechanics: mechanicalSignals, equipment: mechanicalSignals, welding: mechanicalSignals,
  safety: /\b(?:iperc|evaluaci[oó]n de riesgos|inducci[oó]n)\b/gi,
  environment: /\b(?:monitoreo ambiental|cierre de minas|gesti[oó]n ambiental)\b/gi,
  logistics: /\b(?:despacho|inventarios?|recepci[oó]n de materiales)\b/gi,
};

export function trainingMatchText(match, job) {
  const topic = trainingTopics[match.topic].label;
  const shared = sharedWork[match.subject]?.[match.topic];
  const source = decodeHTML(sourceText(job.description));
  const pattern = signalsByTopic[match.topic];
  const evidence = pattern ? [...new Set([...source.matchAll(pattern)].map(([term]) => term.toLocaleLowerCase('es-PE')))].slice(0, 2) : [];
  if (evidence.length) {
    const task = evidence.join(' y ');
    return shared ? `El aviso menciona ${task}. Área en común: ${shared}.` : `El aviso menciona ${task}.`;
  }
  if (shared) return `La formación comparte ${shared} con ${topic}, que aparece en el aviso.`;
  return `El aviso menciona ${topic} ${match.inTitle ? 'en el título' : 'entre los requisitos'}.`;
}
