# Web image.
#
# A single-stage build on purpose. A slim runtime stage would need a second
# `npm ci --omit=dev`, and `drizzle-kit` -- which applies the schema on start --
# is a devDependency. For a local demo the simpler, correct image is worth more
# than a smaller, more fragile one; make it multi-stage when it goes to a real
# host.

FROM node:20-alpine

WORKDIR /app

# Dependencies first: cached across source edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `next build` needs the public backend URL baked into the client bundle. It is
# only read at request time from the browser's point of view, so the compose
# default (localhost, for the developer's own browser) is correct.
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

RUN addgroup -S talkflow && adduser -S talkflow -G talkflow \
 && chown -R talkflow:talkflow /app
USER talkflow

EXPOSE 3000

# The compose service overrides this to run `drizzle-kit migrate` first; the
# image itself just serves, so it stays usable as a plain container.
CMD ["npm", "run", "start"]
