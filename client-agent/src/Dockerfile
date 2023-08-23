FROM node:lts-alpine3.18

RUN apk add --update gcc g++ make python3 bash git gcompat dumb-init
WORKDIR /app

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

COPY ["package.json", "package-lock.json*", ".npmrc", "./"]
RUN npm ci --production --loglevel verbose 
RUN rm .npmrc && unset NPM_TOKEN
RUN npm i --save @metis-data/slow-query-log@0.1.10
COPY . .

ENTRYPOINT [ "dumb-init" ]
CMD [ "npm","start" ]


# FROM arm64v8/node:lts-alpine3.18 AS build

# ENV NODE_ENV production
# RUN apk add --update gcc g++ make python3 bash git gcompat dumb-init

# WORKDIR /usr/src/app

# COPY ["package.json", "package-lock.json*", ".npmrc", "./"]
# RUN --mount=type=secret,mode=0644,id=npmrc,target=/usr/src/app/.npmrc npm ci

# # # ------------------------------------------------------------------------------------------------------------------------

# FROM arm64v8/node:lts-alpine3.18
# ENV NODE_ENV production

# WORKDIR /usr/src/app

# ARG DATADOG_API_KEY
# ARG SENTRY_DSN
# ARG NPM_TOKEN_READ_ONLY
# ENV NPM_TOKEN=$NPM_TOKEN_READ_ONLY
# #checks required args is defined
# RUN ["/bin/sh", "-c", ": ${NPM_TOKEN:?Build argument needs to be set and not null.}"]
# RUN ["/bin/sh", "-c", ": ${DATADOG_API_KEY:?Build argument needs to be set and not null.}"]
# RUN ["/bin/sh", "-c", ": ${SENTRY_DSN:?Build argument needs to be set and not null.}"]

# ENV DATADOG_API_KEY=$DATADOG_API_KEY
# ENV SENTRY_DSN=$SENTRY_DSN

# # RUN npm install --production --silent
# COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init
# COPY --from=build /usr/src/app/node_modules /usr/src/app/node_modules
# COPY . .
# RUN apk add --no-cache postgresql-client

# # RUN chown -R node /usr/src/app
# # USER node

# CMD ["dumb-init", "npm", "start"]




