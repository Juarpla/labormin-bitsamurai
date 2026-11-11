import type { Job } from '../schemas';

const titles = [
  { icon: 'credential', title: 'Ajusta tu CV' },
  { icon: 'practice', title: 'Muestra cómo trabajas' },
  { icon: 'materials', title: 'Prepara la entrevista' },
  { icon: 'time', title: 'Verifica las condiciones' },
  { icon: 'cost', title: 'Aclara la remuneración' },
  { icon: 'message', title: 'Organiza tu postulación' },
] as const;

// Orientación editorial basada en el extracto de cada anuncio.
const byListing = new Map<string, string[]>([
  ['scc-2930', [
    'Ordena tus proyectos de minería superficial por fecha para acreditar los cinco años de planeamiento. Señala en cuáles manejaste costos o presupuestos y qué horizonte cubriste.',
    'Lleva un ejemplo sin datos confidenciales de diseño de fases o depósitos. Si trabajaste con MinePlan 3D o AutoCAD, explica cómo contrastaste el diseño con las reservas y los equipos disponibles.',
    'Practica cómo explicarías un cambio en el plan quinquenal cuando varían las reservas o la capacidad de acarreo. Describe cómo validarías el cambio con datos de producción o de MineOperate OpPro.',
    'La oferta pide licencia de conducir y menciona condiciones climáticas adversas. Confirma la unidad minera, qué categoría de licencia aceptan y con qué frecuencia saldrías a campo.',
    'Pide el rango salarial del puesto de planeamiento a mediano plazo y consulta cómo se cubren los gastos de traslado y alojamiento si debes visitar la operación.',
    'Ten a mano el título de Ingeniería de Minas y tu licencia. Prepara también una explicación breve en inglés de un plan de minado para demostrar el nivel intermedio solicitado.',
  ]],
  ['nv-BMPE-1118510590', [
    'Indica la fecha de egreso de Ingeniería Ambiental. Incluye un proyecto en el que hayas revisado un permiso, armado un expediente o evaluado un impacto ambiental.',
    'Prepara en Excel una matriz de ejemplo con entidad, trámite, requisitos del TUPA, responsable y estado. Explica cómo usarías la matriz para detectar documentos faltantes antes de presentar un expediente.',
    'Ensaya cómo organizarías la biblioteca electrónica de permisos. Usa un caso con dos versiones del mismo documento y explica cuál conservarías como vigente y cómo dejarías trazabilidad.',
    'El aviso ubica la práctica en Lima y menciona la operación Toromocho. Confirma en qué oficina harías el trabajo documentario y si habría visitas a la unidad de Morococha.',
    'Pregunta por la subvención y consulta si Chinalco cubre el traslado o la alimentación en caso de que la práctica requiera visitas de campo para un expediente.',
    'Prepara tu constancia de egreso y un ejemplo breve de informe de permisos en Word o PowerPoint. Confirma qué documento piden para suscribir el convenio de prácticas.',
  ]],
]);

export function applicationPreparation(job: Job, title: string, skill: string | null, tools: string[], experience?: string, question?: string) {
  const role = skill ? `el trabajo de ${skill}` : `el puesto de «${title}»`;
  const examples = job.internship ? 'un proyecto de estudios' : 'un proyecto o trabajo anterior';
  const workplace = job.city ? `en ${job.city}` : `de ${job.company}`;
  const text = byListing.get(job.id) ?? [
    `${job.internship ? 'Indica tu carrera y tu ciclo o fecha de egreso. ' : ''}${experience ? `Para acreditar «${experience}», indica fechas y responsabilidades en tu CV.` : 'Prioriza las responsabilidades que puedas respaldar con ejemplos.'} Destaca ${examples} relacionado con ${role}.`,
    tools.length
      ? `Si has usado ${tools.slice(0, 3).join(', ')}, lleva un ejemplo aplicado a ${role}. Explica cómo comprobaste el resultado.`
      : `Elige una tarea del anuncio de «${title}» y prepara un ejemplo de cómo la resolverías. Indica qué revisarías antes de entregar el trabajo.`,
    question ?? `Pregunta qué primera tarea te asignaría el equipo de ${job.company} y cómo evaluaría tu trabajo en «${title}».`,
    job.remote
      ? `Confirma con ${job.company} qué horario y equipo necesitarías para ${role} desde Perú y si debes asistir a reuniones presenciales.`
      : `Confirma en qué sede ${workplace} se realiza ${role} y si requiere desplazarte a una operación. ${job.internship ? 'Comprueba la duración y el horario de la práctica.' : 'Pregunta por el régimen y el punto de recojo.'}`,
    `Consulta con ${job.company} ${job.internship ? 'el monto de la subvención' : job.salary ? 'si el monto publicado es bruto o neto' : `el rango de sueldo para «${title}»`}. Si te indican que habrá desplazamientos, pregunta cómo los cubren.`,
    job.internship
      ? `Confirma si ${job.company} acepta estudiantes o egresados para «${title}» y qué constancia debes presentar para el convenio.`
      : `Antes de enviar la solicitud para «${title}», comprueba qué credenciales debes adjuntar para acreditar ${skill ?? 'los requisitos del anuncio'}.`,
  ];
  return titles.map((step, i) => ({
    ...step,
    title: job.internship && i === 4 ? 'Consulta la subvención' : job.internship && i === 5 ? 'Revisa el convenio' : step.title,
    text: text[i],
  }));
}
