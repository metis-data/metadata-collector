FROM node:16-alpine

RUN apk add --update gcc g++ make python3

ARG DATADOG_API_KEY
ARG SENTRY_DSN
ARG NPM_TOKEN_READ_ONLY
ENV NPM_TOKEN=$NPM_TOKEN_READ_ONLY
#checks required args is defined
RUN ["/bin/sh", "-c", ": ${NPM_TOKEN:?Build argument needs to be set and not null.}"]
RUN ["/bin/sh", "-c", ": ${DATADOG_API_KEY:?Build argument needs to be set and not null.}"]
RUN ["/bin/sh", "-c", ": ${SENTRY_DSN:?Build argument needs to be set and not null.}"]

ENV DATADOG_API_KEY=$DATADOG_API_KEY
ENV SENTRY_DSN=$SENTRY_DSN

WORKDIR /app/
COPY package*.json /app/
COPY .npmrc /app/.npmrc
RUN npm install --production
RUN rm .npmrc && unset NPM_TOKEN
COPY . /app

ENTRYPOINT [ "npm" ]
CMD [ "start" ]
