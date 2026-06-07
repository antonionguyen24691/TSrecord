# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Setup folder structure
RUN mkdir -p data

EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production
ENV DB_PATH=/data/tsrecord-admin.db

CMD ["node", "dist/index.js"]
