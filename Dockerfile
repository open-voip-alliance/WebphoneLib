FROM node:latest

COPY . /home/webuser/

COPY package.json /home/webuser/package.json
COPY package-lock.json /home/webuser/package-lock.json

RUN chown -R node:node /home/webuser

WORKDIR /home/webuser

USER node

RUN npm ci

EXPOSE 1235
