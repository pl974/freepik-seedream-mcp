FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
ENV PORT=3000
EXPOSE 3000

# Start the HTTP server
CMD ["node", "dist/server.js"]
