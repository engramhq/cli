FROM node:alpine

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

CMD ["node", "be/built/server.js"]