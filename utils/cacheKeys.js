const getLang = urlObj => urlObj.searchParams.get('lang') || 'en';
const formatSlug = (slug, charToRemove) =>
  slug.replace(charToRemove, '').toLowerCase();

/** @param {URL} urlObj */
export const answersKey = urlObj => {
  const slug = formatSlug(urlObj.pathname, '/');
  const lang = getLang(urlObj);

  return `cache:answers:${slug}&lang=${lang}`;
};

/** @param {URL} urlObj */
export const topicKey = urlObj => {
  const slug = formatSlug(urlObj.pathname, '/topic/');
  const lang = getLang(urlObj);

  return `cache:topic:${slug}&lang=${lang}`;
};

/** @param {URL} urlObj */
export const profileKey = urlObj => {
  const slug = formatSlug(urlObj.pathname, '/profile/');
  const lang = getLang(urlObj);

  return `cache:profile:${slug}&lang=${lang}`;
};

/** @param {URL} urlObj */
export const searchKey = urlObj => {
  const q = (urlObj.searchParams.get('q') || '').toLowerCase();
  const after = urlObj.searchParams.get('after') || '';
  const type = urlObj.searchParams.get('type') || 'all_types';
  const time = urlObj.searchParams.get('time') || 'all_times';

  return `cache:search:${q}&type=${type}&time=${time}&after=${after}`;
};

/** @param {URL} urlObj */
export const publishedKey = urlObj => {
  const slug = urlObj.pathname.replace('/profile/', '').replace('/answers/published', '').toLowerCase();
  const lang = getLang(urlObj);

  return `cache:published:${slug}&lang=${lang}`;
};