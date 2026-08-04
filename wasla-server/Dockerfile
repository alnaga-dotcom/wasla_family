# Backend API for Wasla (production)
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# data/ is intentionally NOT copied: it is created at runtime (db.js) and
# persists via the Render disk mounted at /app/data.

RUN mkdir -p /app/logs /app/data/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV WASLA_UPLOADS_DIR=/app/data/uploads
EXPOSE 3000

CMD ["node", "src/server.js"]
