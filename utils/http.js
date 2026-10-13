import { spawn } from 'node:child_process';
import { requestsState } from './state.js';
import env from './env.js';
import log from './log.js';

/**
 * Cloudflare no evalua solo las cabeceras: mira el fingerprint TLS y HTTP/2 del
 * cliente, y deja de aceptar los fingerprints de versiones de navegador que van
 * quedando antiguas. curl-impersonate replica el saludo de un navegador concreto
 * y se actualiza en cuanto sale una version nueva, asi que el fingerprint es un
 * parametro (CURL_IMPERSONATE) y no codigo: cuando envejezca se cambia la
 * variable y se sube la imagen de curl-impersonate en el Dockerfile.
 *
 * La configuracion (url, cabeceras, cookies, cuerpo) viaja por stdin con
 * --config, no como argumentos: los argumentos de un proceso son visibles
 * para cualquiera que liste procesos en la maquina, y las cookies de sesion
 * no deben estarlo.
 */

/** separa el cuerpo de la respuesta de los metadatos que escribe --write-out */
const MARCA = '\n@@quetre-curl@@\n';

/** la identificacion de version del frontend, extraida del HTML de cualquier pagina */
let revision = null;

const cookieHeader = () =>
  Object.entries(requestsState.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

/** fusiona por nombre en lugar de sustituir el jar */
const mergeCookies = setCookies => {
  for (const valor of setCookies ?? []) {
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

/** fallo sin respuesta HTTP (timeout, DNS, conexion): upstreamError lo trata como NETWORK */
const falloRed = (codigo, detalle) => {
  const e = new Error(detalle || `curl salio con codigo ${codigo}`);
  e.isAxiosError = true;
  e.code = `CURL_${codigo}`;
  return e;
};

/**
 * el challenge de Cloudflare no es un rate limit: significa que el fingerprint
 * ya no pasa. Esperar no lo arregla, asi que no activa el cooldown.
 */
const esChallenge = (status, headers) => status === 403 && headers['cf-mitigated'] === 'challenge';

const registrarCooldown = (status, headers) => {
  if (esChallenge(status, headers)) return;
  if (status === 429 || status === 403) {
    requestsState.retryAfter = Date.now() + env.RATE_LIMIT_COOLDOWN;
  }
};

/** entrecomilla un valor para el formato de fichero de configuracion de curl */
const comillas = valor =>
  `"${String(valor)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')}"`;

/**
 * ejecuta una peticion con curl-impersonate.
 * @returns {Promise<{status: number, data: string, headers: Record<string, string>, setCookies: string[]}>}
 */
const curl = ({ url, headers, body }) =>
  new Promise((resolve, reject) => {
    const config = [
      `url = ${comillas(url)}`,
      // un valor null quita la cabecera que curl-impersonate pone por defecto
      ...headers.map(([k, v]) => `header = ${comillas(v === null ? `${k}:` : `${k}: ${v}`)}`),
      ...(body === undefined ? [] : [`data-raw = ${comillas(body)}`]),
    ].join('\n');

    const args = [
      '--impersonate',
      env.CURL_IMPERSONATE,
      '--compressed',
      '--silent',
      '--show-error',
      '--max-time',
      String(env.UPSTREAM_TIMEOUT),
      '--config',
      '-',
      '--write-out',
      `%{stderr}${MARCA}%{http_code}\n%{header_json}`,
    ];

    const hijo = spawn(env.CURL_IMPERSONATE_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const salida = [];
    const errores = [];

    hijo.stdout.on('data', trozo => salida.push(trozo));
    hijo.stderr.on('data', trozo => errores.push(trozo));
    hijo.on('error', err => reject(falloRed('SPAWN', `${env.CURL_IMPERSONATE_BIN}: ${err.message}`)));

    hijo.on('close', codigo => {
      const texto = Buffer.concat(errores).toString('utf8');
      const i = texto.lastIndexOf(MARCA);
      const mensaje = (i === -1 ? texto : texto.slice(0, i)).trim();

      if (codigo !== 0 || i === -1) {
        reject(falloRed(codigo, mensaje));
        return;
      }

      const meta = texto.slice(i + MARCA.length);
      const salto = meta.indexOf('\n');
      const status = Number(meta.slice(0, salto));

      let crudas = {};
      try {
        crudas = JSON.parse(meta.slice(salto + 1));
      } catch {
        log('http: no se pudieron leer las cabeceras de la respuesta');
      }

      const cabeceras = Object.fromEntries(
        Object.entries(crudas).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])
      );

      resolve({
        status,
        data: Buffer.concat(salida).toString('utf8'),
        headers: cabeceras,
        setCookies: crudas['set-cookie'] ?? [],
      });
    });

    hijo.stdin.end(config);
  });

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

  const r = await curl({ url: destino, headers: cabeceras });

  mergeCookies(r.setCookies);
  revision = (r.data.match(/"revision":\s*"([a-f0-9]+)"/) || [])[1] ?? revision;

  if (r.status >= 400) {
    registrarCooldown(r.status, r.headers);
    throw fallo(r.status, r.headers, r.data);
  }

  return { status: r.status, data: r.data, headers: r.headers };
};

/**
 * Cloudflare protege el metodo POST con mas dureza que los GET: exige las
 * cabeceras propietarias que emite el frontend de Quora. Sin ellas responde
 * challenge aunque el fingerprint sea correcto.
 */
const post = async (url, cuerpo, { headers = {} } = {}) => {
  const destino = new URL(url, `${env.QUORA_BASE_URL.replace(/\/$/, '')}/`).href;

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
    // el perfil del navegador trae cabeceras de navegacion; un fetch() no las envia
    'Upgrade-Insecure-Requests': null,
    'Sec-Fetch-User': null,
    ...headers,
    ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
  });

  const r = await curl({ url: destino, headers: cabeceras, body: JSON.stringify(cuerpo) });
  mergeCookies(r.setCookies);

  if (r.status >= 400) {
    registrarCooldown(r.status, r.headers);
    throw fallo(r.status, r.headers, r.data);
  }

  let data;
  try {
    data = JSON.parse(r.data);
  } catch {
    log(`http: respuesta no JSON en ${destino} (${r.data.length} bytes)`);
    throw fallo(r.status, r.headers, r.data);
  }

  return { status: r.status, data, headers: r.headers };
};

export const getBaseUrl = lang =>
  !lang || lang === 'www' || lang === 'en' ? undefined : `https://${lang}.quora.com`;

export const getRevision = () => revision;

export default { get, post };
