import * as cheerio from 'cheerio';
import axiosInstance, { getBaseUrl } from '../utils/axiosInstance.js';
import AppError from '../utils/AppError.js';
import parse from '../utils/parse.js';
import upstreamError from '../utils/upstreamError.js';
import enqueue from '../utils/queue.js';
import dumpBody from '../utils/dumpBody.js';

/**
 * makes a call to quora.com(with the resourceStr appended) and returns parsed JSON containing the data about the resource requested.
 * @param {string} resourceStr a string after the baseURL
 * @param {{keyword: string, lang?: string, toEncode?: boolean}} options additional options
 * @returns JSON containing the result
 * @example await fetcher('What-is-free-and-open-software'); // will return object containing answers
 * await fetcher('topic/Space-Physics'); // will return 'space physics' topic object
 * await fetcher('profile/Charlie-Cheever'); // will return object containing information about charlie cheever
 */
const fetcher = async (resourceStr, { keyword, lang, toEncode = true }) => {
  try {
    // as url might contain unescaped chars. so, encoding it right away
    const str = toEncode ? encodeURIComponent(resourceStr) : resourceStr;
    const res = await enqueue(() =>
      axiosInstance.get(str, { baseURL: getBaseUrl(lang) })
    );

    const $ = cheerio.load(res.data);

    const regex = new RegExp(String.raw`"{\\"data\\":\{\\"${keyword}.*?\}"`);

    let rawData;
    $('body script').each((i, el) => {
      const extractedVal = $(el).html().match(regex)?.[0];

      if (extractedVal) {
        rawData = extractedVal;
        return false; // breaks loop
      }
      return true;
    });

    if (!rawData) {
      const file = await dumpBody(res.data, resourceStr);
      const e = new AppError('Quora no ha devuelto los datos de la página.', 502);
      e.code = 'EMPTY_PAYLOAD';
      e.detail = `bytes=${res.data?.length ?? 0}${file ? ` dump=${file}` : ''}`;
      throw e;
    }

    return parse(rawData);
  } catch (err) {
    throw upstreamError(err);
  }
};

export default fetcher;
