import { buildSitemap, buildRobots } from '../services/seo.service.js';

export async function sitemap(_req, res) {
  const xml = await buildSitemap();
  res.type('application/xml').send(xml);
}

export function robots(_req, res) {
  res.type('text/plain').send(buildRobots());
}
