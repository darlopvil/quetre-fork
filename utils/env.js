import process from 'node:process';

const env = {
  QUORA_BASE_URL: process.env.QUORA_BASE_URL || 'https://www.quora.com',
  FLARESOLVERR_URL: process.env.FLARESOLVERR_URL,
  FLARESOLVERR_TIMEOUT: Number(process.env.FLARESOLVERR_TIMEOUT) || 120000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  USER_AGENT:
    process.env.USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  ACCEPT: process.env.ACCEPT || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  ACCEPT_LANGUAGE: process.env.ACCEPT_LANGUAGE || 'es-ES,es;q=0.9,en;q=0.8',
  ACCEPT_ENCODING: process.env.ACCEPT_ENCODING || 'gzip, deflate, br',
  NO_UPGRADE: process.env.NO_UPGRADE || false,
  CACHE_PERIOD: process.env.CACHE_PERIOD || '1y',
  MIN_REQUEST_INTERVAL: Number(process.env.MIN_REQUEST_INTERVAL) || 2000,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_TTL: Number(process.env.REDIS_TTL) || 86400,
  REDIS_HARD_TTL: Number(process.env.REDIS_HARD_TTL) || 2592000,
  RATE_LIMIT_COOLDOWN: Number.isNaN(+process.env.RATE_LIMIT_COOLDOWN)
    ? 7_200_000
    : Number(process.env.RATE_LIMIT_COOLDOWN),
  STORE_DIR: process.env.STORE_DIR ?? '/app/store',
  QUORA_SESSION_COOKIES: process.env.QUORA_SESSION_COOKIES || '',
  SEARCH_QUERY_HASH:
    process.env.SEARCH_QUERY_HASH ||
    'deb8d8c3f230ef7568c0895df972ada793afb470ecd151e07453f7b7c0e51134',
};

export default env;
