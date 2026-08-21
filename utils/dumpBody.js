import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import log from './log.js';

const DIR = '/app/dumps';
const KEEP = 10;

/** guarda el HTML recibido para poder analizarlo después; rota los N últimos */
const dumpBody = async (html, label) => {
  try {
    await mkdir(DIR, { recursive: true });
    const name = `${Date.now()}-${label.replace(/[^\w-]/g, '_').slice(0, 60)}.html`;
    await writeFile(path.join(DIR, name), html ?? '');

    const files = (await readdir(DIR)).filter(f => f.endsWith('.html')).sort();
    await Promise.all(files.slice(0, -KEEP).map(f => unlink(path.join(DIR, f))));

    return name;
  } catch (err) {
    log(`no se pudo volcar el cuerpo: ${err.message}`);
    return null;
  }
};

export default dumpBody;