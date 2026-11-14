import { localPresentation } from './job-presentation.mjs';
import { roleTopics, topicLabel } from './job-matching.mjs';

export function publishedRole(job) {
  const sections = localPresentation(job.description.replace(
    /(?:Responsabilidades|Funciones(?: principales)?|Temas de aprendizaje|Requisitos(?: del puesto)?)\s*:\s*/gi,
    heading => /temas de aprendizaje/i.test(heading) ? '<br>Funciones:<br>' : `<br>${heading.trim()}<br>`,
  ));
  const collect = heading => sections.filter(section => section.heading === heading).flatMap(section => section.blocks)
    .flatMap(block => block.split(/(?:^|(?<=[.!?])|\s)[•-]\s+|(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/u))
    .map(block => block.trim()).filter(block => block.length >= 16 && block.length <= 240);
  const specialty = roleTopics(job).title.map(topicLabel).find(Boolean);
  return {
    tasks: [...new Set(collect('duties'))].slice(0, 4),
    requirements: [...new Set(collect('requirements'))].slice(0, 3),
    specialty,
  };
}
