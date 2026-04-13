FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev

FROM base AS final
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs

# Install pg_isready equivalent via netcat for healthcheck waiting
RUN apk add --no-cache postgresql-client

EXPOSE 5000

# Wait for DB, run migrations, seed, then start
CMD sh -c '\
  echo "Waiting for database..." && \
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; do sleep 1; done && \
  echo "DB ready. Running migrations..." && \
  node migrations/run.js && \
  node seeds/run.js && \
  echo "Starting server..." && \
  node server.js'
