FROM node:18-alpine

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV production

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies using npm ci
# npm ci is generally faster and more reliable for production builds
# --only=production ensures only dependencies needed for running the app are installed
RUN npm ci --only=production

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the application
# This uses the "start" script from package.json: "node src/index.js"
CMD ["npm", "start"]