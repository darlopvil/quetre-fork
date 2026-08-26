import express from 'express';
import { about, privacy, unimplemented, gone, archive, search } from '../controllers/viewController.js';
import { checkCache, checkRateLimit, setCache, excludeStaticPaths } from '../middlewares/middlewares.js';
import { render } from '../middlewares/viewMiddlewares.js';
import { answers, topic, profile, redirect, published } from '../controllers/controller.js';
import { answersKey, profileKey, topicKey, searchKey, publishedKey } from '../utils/cacheKeys.js';

const viewRouter = express.Router();

viewRouter.get(
  '/search',
  checkCache(searchKey),
  checkRateLimit,
  search,
  setCache,
  render('search'),
);
viewRouter.get('/(|about)', about);
viewRouter.get('/privacy', privacy);
viewRouter.get('/archive', archive);
viewRouter.get(
  '/profile/:name/answers/published',
  checkCache(publishedKey),
  checkRateLimit,
  published,
  setCache,
  render('published'),
);
viewRouter.get(
  '/profile/:name',
  checkCache(profileKey),
  checkRateLimit,
  profile,
  setCache,
  render('profile'),
);
viewRouter.get(
  '/topic/:slug',
  checkCache(topicKey),
  checkRateLimit,
  topic,
  setCache,
  render('topic'),
);
viewRouter.get(
  '/unanswered/:slug',
  checkCache(answersKey),
  checkRateLimit,
  answers,
  setCache,
  render('answers'),
);
viewRouter.get('/space/:name', unimplemented);
viewRouter.get('/space/:name/:slug', unimplemented);
viewRouter.get(
  '/:slug',
   excludeStaticPaths,
  checkCache(answersKey),
  checkRateLimit,
  answers,
  setCache,
  render('answers'),
);
viewRouter.get('/redirect/*', redirect); // eg: /redirect/https://www.quora.com/topic/linux

export default viewRouter;