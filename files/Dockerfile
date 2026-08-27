FROM node:20-slim

# resvg tarvitsee fontit tekstin rasterointiin
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY render.mjs server.mjs fetch-data.mjs build-pages.mjs ./
COPY public ./public
# valinnainen: omat brändifontit
COPY font[s] ./fonts

# ensimmäinen data mukaan imageen, cron päivittää sen myöhemmin volumeen
COPY data.json ./data.json

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
