export const requestsState = {
  /** cookies de sesión de Quora, fusionadas por nombre según llegan */
  /** @type {Record<string, string>} */
  cookies: {},
  /** @type {number?} */
  retryAfter: null,
};