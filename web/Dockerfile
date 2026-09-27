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
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .

# `next build` needs the public backend URL baked into the client bundle. It is
# only read at request time from the browser's point of view, so the compose
# default (localhost, for the developer's own browser) is correct.
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1

# Page-data collection imports every route module, and the Drizzle client is
# constructed at import time (`neon(process.env.DATABASE_URL)` in src/db), so
# the build needs *a* connection string even though it never connects. The
# real one arrives at runtime from compose; this placeholder only has to keep
# the constructor from throwing. Cleared again below so a bare `docker run`
# without env fails loudly rather than silently dialling a dummy database.
ARG BUILD_DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$BUILD_DATABASE_URL
RUN npm run build
ENV DATABASE_URL=

RUN addgroup -S talkflow && adduser -S talkflow -G talkflow \
 && chown -R talkflow:talkflow /app
USER talkflow

EXPOSE 3000

# The compose service overrides this to run `drizzle-kit migrate` first; the
# image itself just serves, so it stays usable as a plain container.
CMD ["npm", "run", "start"]
