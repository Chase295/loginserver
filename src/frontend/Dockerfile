# Stage 1: Build the React application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies using npm ci for cleaner, more reliable builds
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the built application using a lightweight static server
FROM node:18-alpine

WORKDIR /app

# Install 'serve' to act as a static file server
RUN npm install -g serve

# Copy the build output from the builder stage
COPY --from=builder /app/build ./build

# Expose the port the server will listen on (same as before)
EXPOSE 3000

# Serve the build folder.
# The '-s' flag means serve it as a SPA (redirect all not-found to index.html)
# '-l 3000' means listen on port 3000
CMD ["serve", "-s", "build", "-l", "3000"]