import { localPresentation } from './job-presentation.mjs';
import { roleTopics, topicLabel } from './job-matching.mjs';

export function publishedRole(job) {
  const sections = localPresentation(job.description.replace(
    /(?:Responsabilidades|Funciones(?: principales)?|Temas de aprendizaje|Requisitos(?: del puesto)?)\s*:\s*/gi,
    heading => `<br>${heading.trim()}<br>`,
  ));
  const collect = heading => sections.filter(section => section.heading === heading).flatMap(section => section.blocks)
    .flatMap(block => block.split(/(?:^|(?<=[.!?])|\s)[•-]\s+|(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/u))
    .map(block => block.trim()).filter(block => block.length >= 16 && block.length <= 240);
  const geotechnical = /\bgeotecnia\b/i.test(job.title);
  const tasks = [...new Set(collect('duties'))]
    .map(block => block.split(/\s*¡(?:Te invitamos|Únete)\b/iu)[0].trim()).filter(Boolean).slice(0, 5);
  const explainsRockSupport = geotechnical && /macizo rocoso/i.test(tasks.join(' ')) && /sostenimiento/i.test(tasks.join(' '));
  return {
    tasks,
    requirements: [...new Set(collect('requirements'))].slice(0, 3),
    specialty: geotechnical ? 'geotecnia' : roleTopics(job).title.map(topicLabel).find(Boolean),
    explanation: explainsRockSupport
      ? 'En geotecnia subterránea, evaluar el macizo rocoso ayuda a identificar qué zonas necesitan soporte. Las mediciones y los controles de instalación permiten registrar en los reportes geomecánicos si el sostenimiento cumple lo previsto.'
      : undefined,
  };
}
