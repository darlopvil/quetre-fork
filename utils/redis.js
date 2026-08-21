/* eslint-disable no-unused-vars */
import Redis from 'ioredis';
import env from './env.js';

const redisUrl = env.REDIS_URL;

/** frescura: durante cuánto tiempo una entrada se considera actual */
export const ttl = env.REDIS_TTL;
/** retención: cuánto sobrevive la entrada en Redis, ya caducada, para rescates */
export const hardTtl = env.REDIS_HARD_TTL;

/** @type {InstanceType<typeof Redis>} */
const stub = {
  get: async () => { },
  set: async () => { },
  expire: async () => { },
};

const redis = redisUrl ? new Redis(redisUrl) : stub;

export default redis;