FROM node:20-bookworm-slim

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies including dev dependencies
# Rebuild native modules for the container architecture
RUN npm install --legacy-peer-deps && \
    npm rebuild better-sqlite3

# Copy source code
COPY . .

# Build the application with specific Next.js output
RUN npm run build

# Set environment variables
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Start the server using direct tsx execution to avoid npm script indirection
CMD ["npx", "tsx", "server.ts"]
