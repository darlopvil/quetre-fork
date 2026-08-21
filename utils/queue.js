import env from './env.js';

let chain = Promise.resolve();
let lastStart = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * serializa las peticiones a Quora (concurrencia 1) y las separa con un
 * intervalo mínimo más jitter, para no emitir un patrón temporal regular.
 * el reintento interno del interceptor queda dentro del mismo turno.
 */
const enqueue = fn => {
  const turn = chain.then(async () => {
    const base = env.MIN_REQUEST_INTERVAL;
    if (base > 0) {
      const jitter = base * (Math.random() * 0.8 - 0.4); // ±40%
      const wait = lastStart + base + jitter - Date.now();
      if (wait > 0) await sleep(wait);
    }
    lastStart = Date.now();
    return fn();
  });

  // la cadena no debe romperse si un turno falla
  chain = turn.then(
    () => {},
    () => {}
  );

  return turn;
};

export default enqueue;