# ParaApp web app as a small, self-contained Node.js image (Next.js standalone output).
# Build: docker build -t paraapp-web --build-arg NEXT_PUBLIC_SUPABASE_URL=... (see deploy/README.md)

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN pnpm install --frozen-lockfile
COPY . .
# Public values are baked into the browser bundle and the security headers at build time.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ARG NEXT_PUBLIC_OPENAIP_API_KEY=""
ARG NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_OPENAIP_API_KEY=$NEXT_PUBLIC_OPENAIP_API_KEY \
    NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=$NEXT_PUBLIC_AUTH_GOOGLE_ENABLED
RUN pnpm --filter @paraapp/web build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
