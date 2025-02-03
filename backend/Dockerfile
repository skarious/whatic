FROM node:16-alpine

WORKDIR /app

# Install build dependencies and git
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    git \
    openssh

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps flag
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

EXPOSE 8080

# Wait for database script
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Start command
CMD ["/bin/sh", "-c", "/wait-for-it.sh postgres:5432 -- node dist/server.js"]
