import axios from 'axios';
import redis from './redis.js';
import env from './env.js';
import log from './log.js';

const KEY = 'cf:clearance';

/** fallback en memoria si no hay Redis configurado */
let memoryPair = null;
/** evita acuñaciones concurrentes: varias peticiones comparten la misma promesa */
let inflight = null;

/** @returns {Promise<{clearance: string, userAgent: string, mintedAt: number} | null>} */
export const getPair = async () => {
  const raw = await redis.get(KEY);
  if (!raw) return memoryPair;
  try {
    return JSON.parse(raw);
  } catch {
    return memoryPair;
  }
};

/**
 * obtiene una cf_clearance nueva vía FlareSolverr y la persiste junto al
 * User-Agent que la emitió. el par es indivisible: Cloudflare ata la clearance
 * a IP + User-Agent, así que usar uno sin el otro la invalida.
 */
export const mintPair = async () => {
  if (inflight) return inflight;

  inflight = (async () => {
    if (!env.FLARESOLVERR_URL) throw new Error('FLARESOLVERR_URL no configurada');

    const INTENTOS = 3;
    let ultimo = null;

    for (let i = 1; i <= INTENTOS; i++) {
      try {
        const { data } = await axios.post(
          `${env.FLARESOLVERR_URL}/v1`,
          {
            cmd: 'request.get',
            url: env.CLEARANCE_URL,
            maxTimeout: env.FLARESOLVERR_TIMEOUT,
          },
          { timeout: env.FLARESOLVERR_TIMEOUT + 15000 }
        );

        if (data.status !== 'ok') throw new Error(`flaresolverr: ${data.message}`);

        const cookie = data.solution?.cookies?.find(c => c.name === 'cf_clearance');

        // Cloudflare puede no haber emitido la cookie todavia cuando el
        // navegador termina: la solucion llega con status ok pero sin clearance.
        // Reintentar suele bastar; fallar al primer intento deja la instancia
        // sin acceso hasta la siguiente peticion del usuario.
        if (!cookie) throw new Error('la solución no contiene cf_clearance');

        const pair = {
          clearance: cookie.value,
          userAgent: data.solution.userAgent,
          mintedAt: Date.now(),
        };

        memoryPair = pair;
        await redis.set(KEY, JSON.stringify(pair));
        if (i > 1) log(`clearance acuñada en el intento ${i}`, 'success');
        return pair;
      } catch (err) {
        ultimo = err;
        log(`acuñación fallida (intento ${i}/${INTENTOS}): ${err.message}`);
        if (i < INTENTOS) await new Promise(r => setTimeout(r, 5000 * i));
      }
    }

    throw ultimo;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
};