FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY package*.json ./

# Install all dependencies first (including devDependencies for build)
RUN npm install

# Install TypeScript globally for building
RUN npm install -g typescript

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Remove dev dependencies and source files to reduce image size
RUN npm prune --production
RUN rm -rf src/ tsconfig.json

# Clean up build dependencies to reduce image size
RUN apk del python3 make g++

# Create data directory for SQLite database
RUN mkdir -p /app/data && chmod 755 /app/data

# Use existing node user and set permissions
RUN chown -R node:node /app
USER node

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Production command
CMD ["node", "dist/index.js"]