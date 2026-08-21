import axios from 'axios';
import redis from './redis.js';
import env from './env.js';

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

    const { data } = await axios.post(
      `${env.FLARESOLVERR_URL}/v1`,
      {
        cmd: 'request.get',
        url: 'https://www.quora.com/',
        maxTimeout: env.FLARESOLVERR_TIMEOUT,
      },
      { timeout: env.FLARESOLVERR_TIMEOUT + 15000 }
    );

    if (data.status !== 'ok') throw new Error(`flaresolverr: ${data.message}`);

    const cookie = data.solution?.cookies?.find(c => c.name === 'cf_clearance');
    if (!cookie) throw new Error('flaresolverr: la solución no contiene cf_clearance');

    const pair = {
      clearance: cookie.value,
      userAgent: data.solution.userAgent,
      mintedAt: Date.now(),
    };

    memoryPair = pair;
    await redis.set(KEY, JSON.stringify(pair));
    return pair;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
};