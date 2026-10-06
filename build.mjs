import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const fromRoot = (...parts) => join(root, ...parts);
const dist = fromRoot('dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(fromRoot('src'), dist, { recursive: true });
await cp(fromRoot('static'), dist, { recursive: true });
await mkdir(join(dist, 'data'), { recursive: true });

const site = await readFile(fromRoot('content', 'site.json'), 'utf8');
await writeFile(join(dist, 'data', 'site.json'), site);
const siteData = JSON.parse(site);
const indexPath = join(dist, 'index.html');
const index = await readFile(indexPath, 'utf8');
const escapeAttribute = (value = '') => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
await writeFile(indexPath, index
  .replaceAll('__SEO_TITLE__', escapeAttribute(siteData.seo?.title))
  .replaceAll('__SEO_DESCRIPTION__', escapeAttribute(siteData.seo?.description))
  .replaceAll('__SEO_SHARE_IMAGE__', escapeAttribute(siteData.seo?.shareImage))
);

const projectsDirectory = fromRoot('content', 'projects');
const projectFiles = (await readdir(projectsDirectory)).filter((file) => file.endsWith('.json'));
const projects = await Promise.all(
  projectFiles.map(async (file) => JSON.parse(await readFile(join(projectsDirectory, file), 'utf8')))
);
projects.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
await writeFile(join(dist, 'data', 'projects.json'), JSON.stringify(projects, null, 2));

console.log(`Build concluído: ${projects.length} projetos publicados.`);
