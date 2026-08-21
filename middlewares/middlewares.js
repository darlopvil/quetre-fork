import { getValidQueryParams } from '../utils/urlModifiers.js';
import AppError from '../utils/AppError.js';
import { requestsState } from '../utils/state.js';
import catchAsyncErrors from '../utils/catchAsyncErrors.js';
import redis, { ttl, hardTtl } from '../utils/redis.js';
import env from '../utils/env.js';
import { storeSet } from '../utils/store.js';


/** @type {import("express").RequestHandler} */
export const formatReq = (req, _res, next) => {
  req.urlObj = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
  req.query = getValidQueryParams(req.query);
  next();
};

export const checkRateLimit = (_req, res, next) => {
  if (res.locals.data) return next();
  if (!requestsState.retryAfter) return next();

  if (requestsState.retryAfter <= Date.now()) {
    requestsState.retryAfter = null;
    return next();
  }

  // en cooldown: copia caducada antes que error
  if (res.locals.stale) {
    res.locals.data = res.locals.stale;
    res.locals.fromStale = true;
    return next();
  }

  next(new AppError('Quora is rate limiting this instance. Try another or host your own.', 503));
};

export const setCache = catchAsyncErrors(async (_req, res, next) => {
  if (res.locals.fromCache || res.locals.fromStale) return next();

  const entry = { data: res.locals.data, freshUntil: Date.now() + ttl * 1000 };
  await redis.set(res.locals.cacheKey, JSON.stringify(entry), 'EX', hardTtl);
  await storeSet(res.locals.cacheKey, res.locals.data);
  next();
});

export const checkCache = cacheKeyFunction =>
  catchAsyncErrors(async (req, res, next) => {
    const key = cacheKeyFunction(req.urlObj);
    res.locals.cacheKey = key;

    const raw = await redis.get(key);
    if (!raw) return next();

    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      return next();
    }
    if (typeof entry?.freshUntil !== 'number') return next();

    if (entry.freshUntil > Date.now()) {
      res.locals.data = entry.data;
      res.locals.fromCache = true;
      await redis.expire(key, hardTtl, 'GT');
    } else {
      res.locals.stale = entry.data;
      res.locals.staleSince = entry.freshUntil;
    }

    next();
  });
