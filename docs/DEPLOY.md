# Despliegue

Hay dos configuraciones en el repo:

| | Despliegue objetivo | Demo pública |
|---|---|---|
| Frontend | GCP Cloud Run (nginx) | **Netlify** ([netlify.toml](../netlify.toml)) |
| APIs | GCP Cloud Run | **Render** ([render.yaml](../render.yaml)) |
| Base de datos | Neon | Neon |
| Secretos | Secret Manager | Variables de entorno de Render y Netlify |

**Por qué la demo no está en GCP:** Cloud Run exige una cuenta de facturación con tarjeta aunque el uso quede en la capa gratuita. Netlify, Render y Neon tienen planes gratuitos sin tarjeta. La configuración de GCP queda completa y lista: cambiar de plataforma no toca el código, porque las tres apps son contenedores configurados por variables de entorno.

## Demo pública: Netlify + Render + Neon

Publicada en **https://endorse-routes-challenge.netlify.app** (APIs: https://endorse-api.onrender.com y https://routes-api-zbxi.onrender.com).

> En el plan gratuito, Render duerme las APIs tras 15 minutos sin tráfico. La primera petición después tarda cerca de un minuto; las siguientes responden normal.

1. **Neon**: crea un proyecto (región AWS US East 2, Ohio, la misma de las APIs en Render) y copia la *connection string*.
2. **Render** › *New* › *Blueprint* › elige este repositorio. Render lee `render.yaml` y crea `routes-api`, `endorse-api` y el grupo de variables `reto-auth` (con `AUTH_CLIENT_SECRET` y los `JWT_SECRET` generados al azar). Te pide:
   - `DATABASE_URL`: la connection string de Neon.
   - `CORS_ORIGINS` (en las dos APIs): la URL que tendrá el sitio de Netlify, por ejemplo `https://endorse-routes-challenge.netlify.app`.

   Las migraciones corren al arrancar `endorse-api`.
3. **Netlify** › *Add new project* › *Import from GitHub* › este repositorio. `netlify.toml` ya define la carpeta, el build y la redirección de la SPA. En *Environment variables* agrega:
   - `ENDORSE_API_URL` y `ROUTES_API_URL`: las URLs `https://….onrender.com` de cada API.
   - `CLIENT_ID`: `frontend-demo`.
   - `CLIENT_SECRET`: el valor de `AUTH_CLIENT_SECRET` del grupo `reto-auth` en Render.
   - `SECRETS_SCAN_OMIT_KEYS`: `CLIENT_ID,CLIENT_SECRET,ENDORSE_API_URL,ROUTES_API_URL`. Esos valores van a propósito en el `config.js` del navegador (ver el trade-off en README › Seguridad), y así el escáner de secretos de Netlify no detiene el build.

   Al compilar, [frontend/scripts/netlify-postbuild.mjs](../frontend/scripts/netlify-postbuild.mjs) genera `config.js` y `_headers` con la misma CSP que usa nginx (`connect-src` limitado a las dos APIs).
4. Si el nombre del sitio de Netlify no quedó igual al que pusiste en `CORS_ORIGINS`, corrígelo en Render y redespliega las APIs.

Netlify recompila el frontend en cada push a `main`. Esta demo conecta Render por la URL pública del repositorio, así que las APIs se redespliegan con *Manual Deploy*. Si se conecta con la app de GitHub, Render redespliega solo la API cuya carpeta cambió (`buildFilter`).

---

# Despliegue objetivo: GCP (capa gratuita)

## Arquitectura de despliegue

```
Navegador ──HTTPS──► Cloud Run: frontend (nginx + Vue)
    │
    ├──HTTPS + JWT──► Cloud Run: endorse-api (Node/Hapi) ──TLS──► Neon Postgres (free tier)
    └──HTTPS + JWT──► Cloud Run: routes-api (Go)

Secret Manager ──► JWT_SECRET, AUTH_CLIENT_SECRET, DATABASE_URL (montados como env)
Cloud Build    ──► construye cada Dockerfile (no hace falta Docker local)
Artifact Registry ──► guarda las imágenes
```

| Componente | Servicio | Por qué |
|---|---|---|
| 2 APIs + frontend | **Cloud Run** | Free tier mensual (2 M requests, 180k vCPU-s, 360k GiB-s). Escala a cero, HTTPS administrado, revisiones con rollback. |
| Base de datos | **Neon** (Postgres serverless) | Cloud SQL no tiene free tier. Neon da Postgres 16 gratis con TLS y se suspende sin tráfico. Cambiar a Cloud SQL es solo cambiar `DATABASE_URL`. |
| Secretos | **Secret Manager** | 6 versiones activas gratis. Los secretos no quedan en la imagen ni en el repo. |
| Imágenes | **Artifact Registry + Cloud Build** | 0,5 GB y minutos de build incluidos en la capa gratuita. |

> Los límites de la capa gratuita los fija Google y pueden cambiar. Cloud Run exige una cuenta de facturación aunque el uso quede dentro del free tier. Conviene crear una alerta de presupuesto de USD 1.

## Pasos

1. Crea un proyecto en Neon (https://neon.tech) con una base `endorse_db` y copia la cadena de conexión (`...?sslmode=require`).
2. Autentícate en GCP:
   ```bash
   gcloud auth login
   ```
3. Crea `.env.deploy` en la raíz del repo (está en `.gitignore`), así la contraseña no queda en el historial de la terminal:
   ```bash
   GCP_PROJECT=<tu-proyecto>
   NEON_DATABASE_URL='postgresql://<user>:<pass>@<host>.neon.tech/neondb?sslmode=require'
   ```
4. Ejecuta el script:
   ```bash
   ./scripts/deploy-gcp.sh
   ```

El script ([scripts/deploy-gcp.sh](../scripts/deploy-gcp.sh)):

1. Habilita las APIs y crea los secretos (JWT aleatorios con `openssl rand`).
2. Da a la cuenta de servicio de Cloud Run permiso de lectura solo sobre esos secretos.
3. Despliega `routes-api` y `endorse-api` con `--source`. Las migraciones de BD corren al arrancar (`DB_RUN_MIGRATIONS=true`) y son idempotentes.
4. Despliega el `frontend` inyectándole las URLs de las APIs en runtime (`config.js`).
5. Restringe el `CORS_ORIGINS` de las APIs a la URL del frontend.
6. Para no salir de la capa gratuita: deja solo la última versión de cada secreto (4 activas, el límite gratis es 6) y configura una política de limpieza que conserva las 2 imágenes más recientes por servicio en Artifact Registry (límite gratis: 0,5 GB).

## Migraciones en un equipo real

Para la demo, las migraciones corren al arrancar. En un flujo productivo se ejecutarían como un **Cloud Run Job** previo al despliegue, para que varias instancias no compitan por migrar:

```bash
gcloud run jobs deploy endorse-migrate --source endorse-api --region us-central1 \
  --command node --args dist/database/migrate.js \
  --set-secrets DATABASE_URL=endorse-database-url:latest,JWT_SECRET=endorse-jwt-secret:latest,AUTH_CLIENT_SECRET=client-secret:latest \
  --set-env-vars NODE_ENV=production,DB_SSL=true,AUTH_CLIENT_ID=frontend-demo
gcloud run jobs execute endorse-migrate --region us-central1 --wait
```

## Alternativa PaaS para la seguridad

Las APIs validan el JWT en el código. Para mover esa responsabilidad a la plataforma:

- **API Gateway / Cloud Endpoints** delante de Cloud Run, con `securityDefinitions` JWT (issuer y JWKS de Identity Platform), cuotas por API key y Cloud Run en modo privado (`--no-allow-unauthenticated`), invocable solo por la cuenta de servicio del gateway.
- **Identity Platform / Auth0 / Cognito** como emisor (OIDC + PKCE para el SPA), en lugar del endpoint `/v1/auth/token` de demostración.

El código no cambia de forma relevante: el plugin JWT pasaría de clave simétrica a JWKS.
