FROM node:alpine as build

WORKDIR /app

COPY be/package.json ./be/package.json
COPY be/yarn.lock ./be/yarn.lock

RUN yarn --cwd be

COPY ./be/ ./be/

RUN yarn --cwd be build

COPY fe/package.json ./fe/package.json
COPY fe/yarn.lock ./fe/yarn.lock

RUN yarn --cwd fe

COPY fe/ ./fe/

RUN yarn --cwd fe build

COPY ./.env ./.env

FROM node:alpine

WORKDIR /app

COPY --from=build /app/be/built/server.js ./be/built/server.js
COPY --from=build /app/fe/public ./fe/public/

CMD ["node", "be/built/server.js"]
