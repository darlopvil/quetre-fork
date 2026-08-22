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

  return `cache:search:${q}&type=${type}&after=${after}`;
};