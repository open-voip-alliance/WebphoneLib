FROM node:latest

RUN mkdir -p /home/webuser \
    && chown -R node:node /home/webuser

COPY package.json /home/webuser/package.json
COPY package-lock.json /home/webuser/package-lock.json

USER node

WORKDIR /home/webuser

RUN npm ci

EXPOSE 1235
