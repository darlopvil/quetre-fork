import axios from 'axios';
import { requestsState } from './state.js';
import { getPair, mintPair } from './clearance.js';
import env from './env.js';

/** las Client Hints deben derivar del UA acuñado: una incoherencia invalida la clearance */
const buildClientHints = ua => {
  const major = ua.match(/Chrome\/(\d+)/)?.[1];
  if (!major) return {};
  return {
    'sec-ch-ua': `"Chromium";v="${major}", "Not(A:Brand";v="24", "Google Chrome";v="${major}"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
  };
};

const axiosInstance = axios.create({
  baseURL: env.QUORA_BASE_URL,
  headers: {
    'User-Agent': env.USER_AGENT,
    Accept: env.ACCEPT,
    'Accept-Encoding': env.ACCEPT_ENCODING,
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Upgrade-Insecure-Requests': 1,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    Priority: 'u=0, i',
  },
});

const isUpstream = config => !!config?.baseURL?.endsWith('quora.com');

axiosInstance.interceptors.request.use(async config => {
  if (!isUpstream(config)) return config;

  const pair = await getPair();
  const jar = { ...requestsState.cookies };
  if (pair) {
    jar.cf_clearance = pair.clearance;
    config.headers['User-Agent'] = pair.userAgent;
    Object.assign(config.headers, buildClientHints(pair.userAgent));
  }

  const cookieHeader = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookieHeader) config.headers.Cookie = cookieHeader;

  return config;
});

/** fusiona por nombre en lugar de sustituir el jar; descarta cf_clearance */
const mergeCookies = setCookie => {
  if (!setCookie) return;
  for (const raw of setCookie) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx < 1) continue;
    const name = pair.slice(0, idx).trim();
    if (name === 'cf_clearance') continue;
    requestsState.cookies[name] = pair.slice(idx + 1).trim();
  }
};

axiosInstance.interceptors.response.use(
  response => {
    if (isUpstream(response.config)) mergeCookies(response.headers['set-cookie']);
    return response;
  },
  async error => {
    const { config, response } = error;
    if (!isUpstream(config) || !response) throw error;

    const isChallenge =
      response.status === 403 && response.headers['cf-mitigated'] === 'challenge';

    if (isChallenge && !config.__reminted) {
      config.__reminted = true;
      await mintPair();
      return axiosInstance(config);
    }

    if (response.status === 429 || (response.status === 403 && !isChallenge)) {
      requestsState.retryAfter = Date.now() + env.RATE_LIMIT_COOLDOWN;
    }

    throw error;
  }
);

export const getBaseUrl = lang =>
  !lang || lang === 'www' || lang === 'en' ? undefined : `https://${lang}.quora.com`;

export default axiosInstance;