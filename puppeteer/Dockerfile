FROM cypress/browsers:node14.7.0-chrome84
# Secretly using cypress browser base bec we're too lazy to make it ourselves

RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

COPY . /home/pptruser
COPY package.json /home/pptruser/package.json
COPY package-lock.json /home/pptruser/package-lock.json

# Run everything after as non-privileged user.
USER pptruser

WORKDIR /home/pptruser

RUN npm ci
