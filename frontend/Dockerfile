# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --omit=dev --no-package-lock

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Use default nginx config (no custom nginx.conf present in repo)

# Expose default nginx port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

