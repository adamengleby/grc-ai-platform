# Multi-stage Dockerfile for GRC AI Platform
# Optimized for security, performance, and multi-tenant architecture

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY packages/*/package*.json ./packages/*/

# Install dependencies
RUN npm ci --only=production --prefer-offline --no-audit

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies and clean up
RUN npm prune --production && \
    rm -rf node_modules/*/test && \
    rm -rf node_modules/*/tests && \
    rm -rf node_modules/*/*.md && \
    rm -rf node_modules/*/docs

# Production stage
FROM node:18-alpine AS production

# Install security updates and required tools
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    tini \
    curl \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S app -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=app:nodejs /app/dist ./dist
COPY --from=builder --chown=app:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=app:nodejs /app/package*.json ./

# Copy necessary configuration files
COPY --chown=app:nodejs .env.example ./.env.example

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R app:nodejs /app/logs /app/data

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    ENABLE_AUDIT_LOGS=true

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Switch to non-root user
USER app

# Expose port
EXPOSE 3000

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Development stage (for local development)
FROM node:18-alpine AS development

# Install development dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S app -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package*.json ./packages/*/

# Install all dependencies (including dev dependencies)
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY --chown=app:nodejs . .

# Set environment variables for development
ENV NODE_ENV=development \
    PORT=3000 \
    LOG_LEVEL=debug

# Switch to non-root user
USER app

# Expose port and debug port
EXPOSE 3000 9229

# Start development server with debugging enabled
CMD ["npm", "run", "dev"]

# Test stage (for running tests in CI/CD)
FROM development AS test

# Copy test configuration
COPY jest.config.js ./
COPY .eslintrc.js ./
COPY .prettierrc ./

# Run tests
RUN npm run test && \
    npm run lint && \
    npm run type-check

# Security scanning stage
FROM alpine:latest AS security-scan

# Install security scanning tools
RUN apk add --no-cache \
    curl \
    bash

# Copy application for scanning
COPY --from=builder /app /scan-target

# Run security scans (placeholder - replace with actual security tools)
RUN echo "Running security scans..." && \
    echo "Scanning for secrets..." && \
    echo "Scanning for vulnerabilities..." && \
    echo "Security scan completed"