import * as cheerio from 'cheerio';
import http, { getBaseUrl } from '../utils/http.js';
import AppError from '../utils/AppError.js';
import parse from '../utils/parse.js';
import upstreamError from '../utils/upstreamError.js';
import enqueue from '../utils/queue.js';
import dumpBody from '../utils/dumpBody.js';

/**
 * @param {string} resourceStr a string after the baseURL
 * @param {string} lang
 */
const answersFetcher = async (resourceStr, lang) => {
  try {
    const res = await enqueue(() =>
      http.get(encodeURIComponent(resourceStr), { baseURL: getBaseUrl(lang) })
    );
    const $ = cheerio.load(res.data);

    const rawData = { question: null, answers: [], related: [], answerCount: 0 };

    // there are about 9-10 script tags containing data we need
    $('body script').each((i, el) => {
      const text = $(el).html();
      const matches = text.match(/\.push\((".*")\);/); // data is contained like: someProp.push("<data>");

      if (!matches) return;

      // brittle logic, but works
      const matchedPart = JSON.parse(parse(matches[1])).data;

      // only question block has this word
      if (typeof matchedPart.question?.viewerHasAnswered !== 'undefined') {
        rawData.question = matchedPart.question;

        // primary answer block
      } else if (matchedPart.question?.answers?.edges?.[0].node.answer?.content) {
        rawData.answers.push(matchedPart.question.answers.edges[0].node.answer);

        // other answer blocks
      } else if (
        // eslint-disable-next-line no-underscore-dangle
        matchedPart.node?.__typename === 'QuestionAnswerItem2'
      ) {
        rawData.answers.push(matchedPart.node.answer);

        // related questions block contains both answer count and related questions
      } else if (matchedPart.bottomRelatedQuestionsInfo) {
        rawData.related = matchedPart.bottomRelatedQuestionsInfo.relatedQuestions;
        rawData.answerCount = matchedPart.answerCount;
      }
    });

    if (!rawData.question) {
      const file = await dumpBody(res.data, resourceStr);
      const e = new AppError('Quora no ha devuelto los datos de la página.', 502);
      e.code = 'EMPTY_PAYLOAD';
      e.detail = `bytes=${res.data?.length ?? 0}${file ? ` dump=${file}` : ''}`;
      throw e;
    }

    return rawData;
  } catch (err) {
    throw upstreamError(err);
  }
};

export default answersFetcher;