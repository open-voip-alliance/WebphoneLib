FROM node:latest

COPY package.json /home/webuser/package.json
COPY package-lock.json /home/webuser/package-lock.json

WORKDIR /home/webuser

RUN npm ci

EXPOSE 1235
