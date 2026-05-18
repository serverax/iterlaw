# ============================================================================
# ITERLAW BACKEND SERVICE — CORRECTED
# Matches actual codebase: backend/dist/server.js
# ============================================================================

FROM node:20-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl dumb-init

# Copy package dependencies
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy compiled JavaScript and source
COPY backend/dist/ ./dist/
COPY backend/src/ ./src/

# Health check script
RUN cat > /app/health-check.sh << 'EOF'
#!/bin/sh
set -e
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
  exit 0
else
  exit 1
fi
EOF
RUN chmod +x /app/health-check.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD /app/health-check.sh

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start backend service (actual entry point)
CMD ["node", "dist/server.js"]

# Build:
#   docker build -f backend/Dockerfile -t iterlaw/backend:1.0.0 .
#
# Run:
#   docker run -p 3000:3000 \
#     -e DB_HOST=postgres \
#     -e DB_PORT=5432 \
#     iterlaw/backend:1.0.0
