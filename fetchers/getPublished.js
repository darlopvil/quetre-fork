import fetcher from './fetcher.js';
import AppError from '../utils/AppError.js';
import { quetrefy } from '../utils/urlModifiers.js';

/**
 * las respuestas publicadas vienen inyectadas en el HTML de la ruta, dentro de
 * user.publishedAnswersConnection. no requiere GraphQL ni sesion: a diferencia
 * de la busqueda, Quora las sirve a usuarios anonimos.
 */
const KEYWORD = 'user';

const answerCleaner = answer => ({
  aid: answer.aid,
  isViewable: !!answer.viewerHasAccess,
  text: answer.content ? JSON.parse(answer.content).sections : [],
  url: quetrefy(answer.url),
  creationTime: answer.creationTime,
  updatedTime: answer.updatedTime,
  numComments: answer.numDisplayComments,
  numUpvotes: answer.numUpvotes,
  numViews: answer.numViews,
  numShares: answer.numShares,
  isSensitive: answer.isSensitive,
  question: {
    text: answer.question?.title ? JSON.parse(answer.question.title).sections : [],
    url: quetrefy(answer.question?.url),
    qid: answer.question?.qid,
  },
  author: {
    uid: answer.author?.uid,
    isAnon: answer.author?.isAnon,
    image: answer.author?.profileImageUrl,
    isVerified: answer.author?.isVerified,
    url: quetrefy(answer.author?.profileUrl),
    name: `${answer.author?.names?.[0]?.givenName ?? ''} ${answer.author?.names?.[0]?.familyName ?? ''}`.trim(),
    credential: answer.authorCredential?.translatedString,
  },
});

const getPublished = async (slug, lang) => {
  const res = await fetcher(`profile/${slug}/answers/published`, {
    keyword: KEYWORD,
    lang,
    toEncode: false,
  });

  const {
    data: { [KEYWORD]: rawData },
  } = JSON.parse(res);

  if (!rawData) throw new AppError('No encontrado', 404);

  const conn = rawData.publishedAnswersConnection;

  return {
    name: `${rawData.names?.[0]?.givenName ?? ''} ${rawData.names?.[0]?.familyName ?? ''}`.trim(),
    profileUrl: quetrefy(rawData.profileUrl),
    numPublished: rawData.numPublishedAnswers ?? 0,
    answers: (conn?.edges ?? []).map(e => answerCleaner(e.node)),
    pageInfo: conn?.pageInfo ?? null,
  };
};

export default getPublished;