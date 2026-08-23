import catchAsyncErrors from '../utils/catchAsyncErrors.js';
import { acceptedLanguages } from '../utils/constants.js';
import getAnswers from '../fetchers/getAnswers.js';
import getTopic from '../fetchers/getTopic.js';
import getProfile from '../fetchers/getProfile.js';
import getPublished from '../fetchers/getPublished.js';

export const published = catchAsyncErrors(async (req, res, next) => {
  const { params: { name }, query: { lang } } = req;

  const data = await resolve(res, () => getPublished(name, lang));

  res.locals.data = data;
  res.locals.title = `Respuestas publicadas de ${data.name}`;
  res.locals.description = `Respuestas de ${data.name} publicadas en otros medios.`;

  next();
});

export const answers = catchAsyncErrors(async (req, res, next) => {
  const { params: { slug }, query: { lang } } = req;

  /** @type{Awaited<ReturnType<typeof getAnswers>>} */
  const data = await resolve(res, () => getAnswers(slug, lang));
  if (!data) data = await getAnswers(slug, lang);

  const title = data.question.text[0].spans.map(span => span.text).join('');

  res.locals.data = data;
  res.locals.title = title;
  res.locals.description = `Respuestas a ${title}`;

  next();
});

export const topic = catchAsyncErrors(async (req, res, next) => {
  const { params: { slug }, query: { lang } } = req;

  /** @type{Awaited<ReturnType<typeof getTopic>>} */
  const data = await resolve(res, () => getTopic(slug, lang));
  if (!data) data = await getTopic(slug, lang);

  res.locals.data = data;
  res.locals.title = data.name;
  res.locals.description = `Información sobre el tema ${data.name}.`;

  next();
});

export const profile = catchAsyncErrors(async (req, res, next) => {
  const { params: { name }, query: { lang } } = req;

  /** @type{Awaited<ReturnType<typeof getProfile>>} */
  const data = await resolve(res, () => getProfile(name, lang));
  if (!data) data = await getProfile(name, lang);

  res.locals.data = data;
  res.locals.title = data.basic.name;
  res.locals.description = `Perfil de ${data.basic.name}.`;

  next();
});

const regex = /^https:\/\/(.{2,})\.quora\.com(\/.*)$/; // local helper constant
export const redirect = (req, res, _next) => {
  const url = req.originalUrl.replace('/redirect/', ''); // removing `/redirect/` part.
  const match = regex.exec(url);

  if (!match) return res.redirect('/');

  const [_, subdomain, rest] = match; // eg: subdomain: 'es', rest: '/topic/linux?share=1'
  let link;

  if (acceptedLanguages.includes(subdomain))
    // adding lang param
    link = `${rest}${rest.includes('?') ? '&' : '?'}lang=${subdomain}`;
  else if (subdomain === 'www')
    link = rest; // doing nothing
  else link = `/space/${subdomain}${rest}`; // gotta be a space url.

  return res.redirect(link);
};

/** devuelve datos frescos, o la copia caducada si upstream falla */
const resolve = async (res, fetcher) => {
  if (res.locals.data) return res.locals.data;
  try {
    return await fetcher();
  } catch (err) {
    if (!res.locals.stale) throw err;
    res.locals.fromStale = true;
    return res.locals.stale;
  }
};
