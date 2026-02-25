# Git Drive - Docker Image
# Includes CLI, server, and web UI

FROM node:20-alpine

# Install git and util-linux (for lsblk)
RUN apk add --no-cache git util-linux

WORKDIR /app

# Copy package files
COPY package.json ./
COPY dist ./dist/
COPY ui ./ui/

# Install production dependencies only
RUN npm install --omit=dev

# Expose the web UI port
EXPOSE 4483

# Set environment
ENV GIT_DRIVE_PORT=4483

# Default command starts the server
CMD ["node", "dist/server.js"]