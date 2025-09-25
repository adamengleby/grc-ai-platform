# Production stage - simplified to use existing dist
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy pre-built application
COPY dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcpserver -u 1001

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown -R mcpserver:nodejs /app/data

# Switch to non-root user
USER mcpserver

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3006/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the MCP SSE server
CMD ["node", "dist/mcp-sse-server.js"]