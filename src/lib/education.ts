import records from '../data/education.json';

// Discovery metadata and short editorial labels, derived from the documented
// records. These never overwrite source facts or imply an open admission.
export const trainingGroups = [
  { id: 'habilidad', sourceGroup: 'cursos', label: 'Una habilidad', description: 'Aprende algo nuevo o mejora lo que sabes', image: 'habilidad' },
  { id: 'certificado', sourceGroup: 'oficios', label: 'Un certificado', description: 'Aprende con práctica', image: 'certificado' },
  { id: 'carrera', sourceGroup: 'carreras', label: 'Una carrera', description: 'Construye una base técnica', image: 'carrera' },
] as const;

export const departments = ['Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali'];

type Discovery = {
  title: string;
  department: string;
  mode: 'virtual' | 'presencial' | 'consultar';
  costKind: 'gratuito' | 'parcial' | 'consultar';
  costLabel: string;
  costNote: string;
};

const discovery: Record<string, Discovery> = {
  'capacita-t': { title: 'Competencias digitales y seguridad en el trabajo', department: '', mode: 'virtual', costKind: 'gratuito', costLabel: 'Cursos y certificación gratuitos', costNote: 'A tu ritmo · según el curso' },
  'jovenes-productivos': { title: 'Capacitación laboral', department: '', mode: 'consultar', costKind: 'gratuito', costLabel: 'Capacitación gratuita', costNote: 'Acceso y modalidad según convocatoria' },
  'promae-comas': { title: 'Instalaciones eléctricas', department: 'Lima', mode: 'presencial', costKind: 'consultar', costLabel: 'Precio por consultar', costNote: 'Calendario y cupos por confirmar' },
  'cetpro-juliaca': { title: 'Electricidad y electrónica', department: 'Puno', mode: 'consultar', costKind: 'parcial', costLabel: 'Sin matrícula ni pensiones', costNote: 'Mantenimiento: monto por confirmar' },
  'jose-carlos-mariategui': { title: 'Electrónica Industrial', department: 'Moquegua', mode: 'presencial', costKind: 'parcial', costLabel: 'Admisión: S/210 · matrícula base: S/100', costNote: 'Tarifario 2026 · adicionales y total por confirmar' },
  'narciso-villanueva': { title: 'Explotación Minera', department: 'Áncash', mode: 'consultar', costKind: 'parcial', costLabel: 'Sin mensualidades de enseñanza', costNote: 'Matrícula y otros pagos: total no confirmado' },
  'chalhuahuacho': { title: 'Explotación Minera y Mecánica de Producción Industrial', department: 'Apurímac', mode: 'consultar', costKind: 'parcial', costLabel: 'Costo total por consultar', costNote: 'Examen 2026-I: S/180 · importe histórico' },
};

export const education = records.map(record => {
  const metadata = discovery[record.id];
  const group = trainingGroups.find(group => group.sourceGroup === record.group);
  if (!metadata || !group) throw new Error(`Falta clasificar la opción de formación: ${record.id}`);
  return { ...record, ...metadata, type: group.id };
});

export const trainingGuidePath = '/guias/formacion-minera-gratuita-economica-peru';

export function verifiedDate(date: string) {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
