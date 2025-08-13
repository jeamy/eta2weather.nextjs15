FROM node:20-alpine

WORKDIR /app

# Install dependencies required for builds
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with exact versions
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application with specific Next.js output
RUN npm run build

# Install production dependencies only
RUN npm ci --only=production --legacy-peer-deps

# Set environment variables
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Start the server using direct tsx execution to avoid npm script indirection
CMD ["npx", "tsx", "server.ts"]
