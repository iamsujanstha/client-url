# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions and install all dependencies (including dev)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Run build command (this generates static build in dist/ and server compilation to dist/server.cjs)
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy dependency definitions and install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy only the compiled dist folder containing client assets and built server
COPY --from=builder /app/dist ./dist

# Copy custom data directory if any, to serve as base reference
COPY --from=builder /app/data ./data

# Expose the API and Web server port
EXPOSE 3000

# Declare mountable data directory for persistent collections and history
VOLUME [ "/app/data" ]

# Start the application!
CMD ["npm", "run", "start"]
