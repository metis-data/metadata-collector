FROM node:16-alpine

ARG DATADOG_API_KEY
ARG SENTRY_DSN

#checks required args is defined
RUN ["/bin/sh", "-c", ": ${DATADOG_API_KEY:?Build argument needs to be set and not null.}"]
RUN ["/bin/sh", "-c", ": ${SENTRY_DSN:?Build argument needs to be set and not null.}"]

ENV DATADOG_API_KEY=$DATADOG_API_KEY
ENV SENTRY_DSN=$SENTRY_DSN

WORKDIR /app/
COPY package*.json /app/
RUN npm install --production

COPY . /app

ENTRYPOINT [ "npm" ]
CMD [ "start" ]