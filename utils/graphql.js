import http from './http.js';
import enqueue from './queue.js';
import { requestsState } from './state.js';
import env from './env.js';
import log from './log.js';

/** el formkey deriva de la sesion: estable mientras las cookies lo sean */
let formkey = null;

/** carga las cookies de sesion en el jar. sin ellas la busqueda devuelve vacio */
export const loadSession = () => {
  if (!env.QUORA_SESSION_COOKIES) return false;
  for (const par of env.QUORA_SESSION_COOKIES.split(';')) {
    const i = par.indexOf('=');
    if (i < 1) continue;
    requestsState.cookies[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
  return true;
};

/** extrae el formkey de una pagina cualquiera. debe pedirse ya con la sesion cargada */
const getFormkey = async (forzar = false) => {
  if (formkey && !forzar) return formkey;
  const page = await enqueue(() => http.get('What-is-Linux-4'));
  formkey = (page.data.match(/"formkey":\s*"([a-f0-9]+)"/) || [])[1] || null;
  if (!formkey) log('graphql: no se pudo extraer el formkey');
  return formkey;
};

/**
 * ejecuta una consulta persistida contra el endpoint GraphQL de Quora.
 * @param {string} queryName nombre de la operacion
 * @param {string} hash hash de la consulta persistida
 * @param {object} variables variables de la operacion
 */
export const gql = async (queryName, hash, variables) => {
  const enviar = async fk => {
    const r = await enqueue(() =>
      http.post(
        `/graphql/gql_para_POST?q=${queryName}`,
        { queryName, extensions: { hash }, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
            'quora-formkey': fk,
            Origin: 'https://www.quora.com',
            Referer: 'https://www.quora.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
          },
        }
      )
    );
    return r.data;
  };

  let data = await enviar(await getFormkey());

  // sesion no reconocida: el formkey pudo caducar. se reextrae y se reintenta una vez
  if (data?.data?.viewer?.user === null) {
    data = await enviar(await getFormkey(true));
  }

  return data;
};