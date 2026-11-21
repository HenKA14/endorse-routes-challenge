# syntax=docker/dockerfile:1.7

# --- Build: bundle estático de Vite ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime: nginx sin privilegios (escucha en 8080, como espera Cloud Run) ---
FROM nginxinc/nginx-unprivileged:1.27-alpine
# La imagen procesa /etc/nginx/templates/*.template con envsubst al arrancar
# y ejecuta los scripts de /docker-entrypoint.d/.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 nginx/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
ENV ENDORSE_API_URL=http://localhost:3000 \
    ROUTES_API_URL=http://localhost:8080 \
    CLIENT_ID=frontend-demo \
    CLIENT_SECRET=frontend-demo-secret \
    NGINX_ENVSUBST_FILTER="^(ENDORSE_API_URL|ROUTES_API_URL)$"
EXPOSE 8080
