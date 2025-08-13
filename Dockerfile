FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Set environment variables
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

# Start the server
CMD ["npm", "run", "start"]
