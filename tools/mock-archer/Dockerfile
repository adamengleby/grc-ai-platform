FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3007

CMD ["node", "src/index.js"]