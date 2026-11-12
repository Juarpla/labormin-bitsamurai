import type { ComponentProps, MarkdownInstance } from 'astro';
import type GuideIcon from '../components/guides/GuideIcon.astro';

export const guideGroups = [
  { id: 'primer-empleo', title: 'Primer empleo', icon: 'credential' },
  { id: 'formacion', title: 'Formación y seguridad', icon: 'materials' },
  { id: 'evaluar', title: 'Evaluar una oferta', icon: 'time' },
] as const;

type Group = typeof guideGroups[number]['id'];
export type GuideMetadata = {
  title: string;
  description: string;
  group: Group;
  icon: ComponentProps<typeof GuideIcon>['kind'];
  steps: [string, string, string];
};

const articles = import.meta.glob<MarkdownInstance<GuideMetadata>>('../content/guides/*.md', { eager: true });
export const editorialGuides = Object.entries(articles).map(([file, article]) => ({
  slug: file.slice(file.lastIndexOf('/') + 1, -3),
  ...article.frontmatter,
  compiledContent: article.compiledContent,
}));

export const visualGuides: Array<Omit<GuideMetadata, 'steps'> & { slug: string }> = [
  {
    slug: 'formacion-minera-gratuita-economica-peru',
    title: 'Dónde estudiar para minería con poco presupuesto en Perú',
    description: 'Cursos gratuitos, CETPRO e institutos públicos. Compara costos y credenciales.',
    group: 'formacion',
    icon: 'map',
  },
  {
    slug: 'verificar-oferta-remota-visa-salario',
    title: 'Cómo verificar una oferta: remoto, visa y salario',
    description: 'Comprueba los países admitidos y a quién se aplica la remuneración publicada.',
    group: 'evaluar',
    icon: 'remote',
  },
];
