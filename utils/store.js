import path from 'node:path';
import crypto from 'node:crypto';
import log from './log.js';
import env from './env.js';
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';

const DIR = env.STORE_DIR;

/** deriva una ruta de fichero legible a partir de la clave de caché */
const fileFor = key => {
  const [type, ...rest] = key.replace(/^cache:/, '').split(':');
  const slug = rest.join(':').replace(/[^\w.\-&=]/g, '_');
  const safe =
    slug.length > 120
      ? `${slug.slice(0, 120)}-${crypto.createHash('sha1').update(slug).digest('hex').slice(0, 8)}`
      : slug;
  return path.join(DIR, type, `${safe || 'index'}.json`);
};

/** guarda de forma permanente. nunca lanza: el archivo es opcional */
export const storeSet = async (key, data) => {
  if (!DIR) return;
  try {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ key, savedAt: Date.now(), data }));
  } catch (err) {
    log(`store: no se pudo guardar ${key}: ${err.message}`);
  }
};

/** @returns {Promise<{savedAt: number, data: unknown} | null>} */
export const storeGet = async key => {
  if (!DIR) return null;
  try {
    const entry = JSON.parse(await readFile(fileFor(key), 'utf8'));
    return typeof entry?.savedAt === 'number' ? entry : null;
  } catch {
    return null;
  }
};

/** lista lo archivado, agrupado por tipo, ordenado por fecha descendente */
export const storeList = async () => {
  if (!DIR) return [];
  try {
    const types = await readdir(DIR, { withFileTypes: true });
    const out = [];

    for (const t of types) {
      if (!t.isDirectory()) continue;
      const files = await readdir(path.join(DIR, t.name));

      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const full = path.join(DIR, t.name, f);
        const { mtimeMs } = await stat(full);
        out.push({
          type: t.name,
          slug: f.replace(/\.json$/, '').split('&lang=')[0],
          lang: f.match(/&lang=([^.]+)/)?.[1] ?? 'en',
          savedAt: mtimeMs,
        });
      }
    }

    return out.sort((a, b) => b.savedAt - a.savedAt);
  } catch (err) {
    log(`store: no se pudo listar: ${err.message}`);
    return [];
  }
};