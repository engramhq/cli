FROM node:alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:alpine

WORKDIR /app

COPY --from=build /app/built/index.js ./built/index.js

CMD ["node", "./built/index.js"]
