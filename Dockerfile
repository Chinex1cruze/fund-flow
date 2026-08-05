# Dockerfile for FundFlow
FROM node:18-alpine
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app
COPY . .

# Ensure data directory exists (will be ephemeral unless Railway volume used)
RUN mkdir -p data

ENV PORT 3000
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
