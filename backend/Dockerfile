# Build context is backend/. The API runs on Fly (syd); see docs/fly-setup.md.
FROM node:24-bookworm-slim AS build
# The Prisma engine needs openssl; ca-certificates for TLS to Supabase.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
# generate resolves the datasource env vars but never connects; placeholders
# keep the build free of real secrets.
RUN DATABASE_URL=postgresql://x:x@localhost:5432/x DIRECT_URL=postgresql://x:x@localhost:5432/x npx prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
USER node
EXPOSE 8080
# CommonJS build: --require (not --import) so Sentry's instrument.js runs before
# anything else is loaded.
CMD ["node", "--require", "./dist/instrument.js", "dist/index.js"]
