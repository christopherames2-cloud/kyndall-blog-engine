# Dockerfile for kyndall-blog-engine (Web Service Version)
# Runs as a web server on DigitalOcean App Platform

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Set timezone to PST
ENV TZ=America/Los_Angeles

# Expose port (DigitalOcean will override with PORT env var)
EXPOSE 8080

# Run the web server
CMD ["node", "src/index.js"]
