# transporte hacia Quora. Cuando Cloudflare deje de aceptar el fingerprint:
# subir esta version y ajustar CURL_IMPERSONATE en el .env
FROM lexiforest/curl-impersonate:v2.1.1-alpine AS curl

FROM node:22-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@8
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run sass:build
RUN pnpm prune --prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=curl /usr/local/bin/curl-impersonate /usr/local/bin/curl-impersonate
# falla el build si al binario le falta alguna libreria
RUN curl-impersonate --version
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
