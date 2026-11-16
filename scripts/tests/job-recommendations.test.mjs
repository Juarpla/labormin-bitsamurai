import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJobRecommendations } from '../../src/lib/job-recommendations.mjs';

test('catalog export ranks related roles and keeps deadlines for subsequent requests', () => {
  const now = new Date('2026-11-16T18:00:00Z');
  const offer = (slug, title, fields = {}) => ({
    id: slug, slug, title, company: slug, companySlug: slug, country: 'PE', remote: false,
    postedAt: '2026-11-15T15:00:00Z', category: 'maintenance', description: '',
    excerpt: slug, ...fields,
  });
  const target = offer('electricista', 'Técnico de mantenimiento eléctrico');
  const electrical = offer('servicio-electrico', 'Técnico electricista', { excerpt: target.excerpt });
  const mechanical = offer('mecanico', 'Técnico de mantenimiento mecánico');
  const practice = offer('practicas', 'Practicante de mantenimiento eléctrico', {
    internship: true, validThrough: '2026-11-18', excerpt: target.excerpt,
  });
  const remote = offer('remoto', 'Técnico electricista', { remote: true });
  const expired = offer('cerrado', 'Practicante de mantenimiento eléctrico', {
    internship: true, validThrough: '2026-11-15',
  });
  const plans = buildJobRecommendations([target, electrical, mechanical, practice, remote, expired], now);
  assert.equal(plans.cerrado, undefined);
  assert.deepEqual(plans.electricista.guidance, [
    { slug: 'practicas', closesAt: '2026-11-19T05:00:00.000Z' },
  ]);
  assert.deepEqual(plans.electricista.related.map(match => match.slug), ['servicio-electrico']);
  assert.deepEqual(plans.practicas.related, []);
  assert.equal(plans.electricista.uniqueExcerpt, false);
  assert.equal(plans.practicas.uniqueExcerpt, true);
});
