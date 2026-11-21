# syntax=docker/dockerfile:1.7

# --- Build: compila TypeScript con todas las dependencias ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# --- Runtime: solo dist + dependencias de producción, usuario no root ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 8080
# Cloud Run envía SIGTERM; node como PID 1 lo recibe y index.ts hace shutdown ordenado.
CMD ["node", "dist/index.js"]
