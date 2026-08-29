import { Impit } from 'impit';
import { requestsState } from './state.js';
import env from './env.js';
import log from './log.js';

/**
 * Cloudflare no evalua solo las cabeceras: mira el fingerprint TLS y HTTP/2 del
 * cliente. Node siempre saluda como Node, por muchas cabeceras de navegador que
 * se le pongan encima. impit implementa el saludo de un navegador real, lo que
 * evita el reto en lugar de tener que resolverlo.
 */
const client = new Impit({ browser: 'chrome' });

/** la identificacion de version del frontend, extraida del HTML de cualquier pagina */
let revision = null;

const toObject = pares => Object.fromEntries(pares ?? []);

const cookieHeader = () =>
  Object.entries(requestsState.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

/** fusiona por nombre en lugar de sustituir el jar */
const mergeCookies = headers => {
  for (const [nombre, valor] of headers ?? []) {
    if (nombre.toLowerCase() !== 'set-cookie') continue;
    const [par] = valor.split(';');
    const i = par.indexOf('=');
    if (i < 1) continue;
    requestsState.cookies[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
};

/** replica la forma de error de axios para no cambiar upstreamError */
const fallo = (status, headers, data) => {
  const e = new Error(`upstream ${status}`);
  e.isAxiosError = true;
  e.response = { status, headers, data };
  return e;
};

const registrarCooldown = status => {
  if (status === 429 || status === 403) {
    requestsState.retryAfter = Date.now() + env.RATE_LIMIT_COOLDOWN;
  }
};

const get = async (url, { baseURL = env.QUORA_BASE_URL, headers = {} } = {}) => {
  const destino = new URL(url, `${baseURL.replace(/\/$/, '')}/`).href;

  const cabeceras = Object.entries({
    Accept: env.ACCEPT,
    'Accept-Language': env.ACCEPT_LANGUAGE,
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    ...headers,
    ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
  });

  const r = await client.fetch(destino, { headers: cabeceras });
  const data = await r.text();
  const cab = toObject(r.headers);

  mergeCookies(r.headers);
  revision = (data.match(/"revision":\s*"([a-f0-9]+)"/) || [])[1] ?? revision;

  if (r.status >= 400) {
    registrarCooldown(r.status);
    throw fallo(r.status, cab, data);
  }

  return { status: r.status, data, headers: cab };
};

/**
 * Cloudflare protege el metodo POST con mas dureza que los GET: exige las
 * cabeceras propietarias que emite el frontend de Quora. Sin ellas responde
 * challenge aunque el fingerprint sea correcto.
 */
const post = async (url, cuerpo, { headers = {} } = {}) => {
  const destino = new URL(url, `${env.QUORA_BASE_URL.replace(/\/$/, '')}/`).href;
  const json = JSON.stringify(cuerpo);

  const cabeceras = Object.entries({
    'Content-Type': 'application/json',
    Accept: '*/*',
    'Accept-Language': env.ACCEPT_LANGUAGE,
    'quora-window-id': `react_${Math.random().toString(36).slice(2, 18)}`,
    'quora-revision': revision ?? '0',
    'quora-canary-revision': 'false',
    'quora-page-creation-time': String(Date.now() * 1000),
    Origin: env.QUORA_BASE_URL,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    ...headers,
    ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
  });

  const r = await client.fetch(destino, {
    method: 'POST',
    headers: cabeceras,
    body: Buffer.from(json),
  });

  const texto = await r.text();
  const cab = toObject(r.headers);
  mergeCookies(r.headers);

  if (r.status >= 400) {
    registrarCooldown(r.status);
    throw fallo(r.status, cab, texto);
  }

  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    log(`http: respuesta no JSON en ${destino} (${texto.length} bytes)`);
    throw fallo(r.status, cab, texto);
  }

  return { status: r.status, data, headers: cab };
};

export const getBaseUrl = lang =>
  !lang || lang === 'www' || lang === 'en' ? undefined : `https://${lang}.quora.com`;

export const getRevision = () => revision;

export default { get, post };