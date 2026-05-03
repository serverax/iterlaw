# Build from repo root:
#   docker build -t iterlawacr3729.azurecr.io/ai-orchestrator:1.0.3 -f apps/ai-orchestrator/Dockerfile apps/ai-orchestrator
#
# 1.0.3 scope: landing page waitlist + AI waitlist controller (see release branch notes).
#
# --- Stage 1: builder ---
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

# --- Stage 2: runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache libc6-compat \
  && addgroup -g 1001 -S app \
  && adduser -S -u 1001 -G app app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
