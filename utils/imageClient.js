import axios from 'axios';
import env from './env.js';

/**
 * cliente exclusivo para el proxy de imagenes. El CDN de Quora no tiene
 * Cloudflare delante, asi que no necesita fingerprint de navegador, y la
 * respuesta se sirve en streaming, que impit no cubre.
 */
export default axios.create({
  headers: {
    'User-Agent': env.USER_AGENT,
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': env.ACCEPT_LANGUAGE,
  },
});