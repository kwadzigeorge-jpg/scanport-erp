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
# Supports both DATABASE_URL (Fly.io/cloud) and individual DB_* vars (Docker Compose)
CMD sh -c '\
  if [ -n "$DATABASE_URL" ]; then \
    _host=$(echo "$DATABASE_URL" | sed -E "s|.*@([^:/]+).*|\1|"); \
    _port=$(echo "$DATABASE_URL" | sed -E "s|.*:([0-9]+)/.*|\1|" | grep -E "^[0-9]+$" || echo "5432"); \
    _user=$(echo "$DATABASE_URL" | sed -E "s|[^/]+//([^:@]+).*|\1|"); \
  else \
    _host="$DB_HOST"; _port="${DB_PORT:-5432}"; _user="${DB_USER:-postgres}"; \
  fi && \
  echo "Waiting for database at $_host:$_port..." && \
  until pg_isready -h "$_host" -p "$_port" -U "$_user" -q; do sleep 2; done && \
  echo "DB ready. Running migrations..." && \
  node migrations/run.js && \
  node seeds/run.js && \
  echo "Starting server..." && \
  node server.js'
