FROM node:latest

COPY . /home/webuser/

RUN chown -R node:node /home/webuser

WORKDIR /home/webuser

USER node

RUN npm ci

EXPOSE 1235
