FROM node:alpine

RUN mkdir -p /usr/src/node-app && chown -R node:node /usr/src/node-app
RUN apk update && apk add make g++ python3 py-pip py3-pip

WORKDIR /usr/src/node-app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

