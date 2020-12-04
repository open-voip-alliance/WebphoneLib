FROM cypress/browsers:node14.7.0-chrome84
# Secretly using cypress browser base bec we're too lazy to make it ourselves

RUN mkdir -p /home/pptruser

COPY . /home/pptruser

COPY package.json /home/pptruser/package.json
COPY package-lock.json /home/pptruser/package-lock.json

WORKDIR /home/pptruser

RUN npm ci
