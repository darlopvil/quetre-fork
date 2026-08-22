import express from 'express';
import { about, unimplemented, image, search } from '../controllers/apiController.js';
import { checkCache, checkRateLimit, setCache } from '../middlewares/middlewares.js';
import { toJson } from '../middlewares/apiMiddlewares.js';
import { answers, topic, profile, published } from '../controllers/controller.js';
import { answersKey, profileKey, topicKey, searchKey, publishedKey } from '../utils/cacheKeys.js';

const apiRouter = express.Router();

apiRouter.get('/search', checkCache(searchKey), checkRateLimit, search, setCache, toJson);
apiRouter.get('/(|about)', about);
apiRouter.get('/image/:domain/:path', image);
apiRouter.get('/profile/:name/answers/published', checkCache(publishedKey), checkRateLimit, published, setCache, toJson);
apiRouter.get('/profile/:name', checkCache(profileKey), checkRateLimit, profile, setCache, toJson);
apiRouter.get('/topic/:slug', checkCache(topicKey), checkRateLimit, topic, setCache, toJson);
apiRouter.get('/unanswered/:slug', checkCache(answersKey), checkRateLimit, answers, setCache, toJson);
apiRouter.get('/space/:name', unimplemented);
apiRouter.get('/space/:name/:slug', unimplemented);
apiRouter.get('/:slug', checkCache(answersKey), checkRateLimit, answers, setCache, toJson);

export default apiRouter;