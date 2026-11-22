# Despliegue en GCP (capa gratuita)

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
3. Ejecuta el script:
   ```bash
   export GCP_PROJECT=<tu-proyecto>
   export NEON_DATABASE_URL='postgres://<user>:<pass>@<host>.neon.tech/endorse_db?sslmode=require'
   ./scripts/deploy-gcp.sh
   ```

El script ([scripts/deploy-gcp.sh](../scripts/deploy-gcp.sh)):

1. Habilita las APIs y crea los secretos (JWT aleatorios con `openssl rand`).
2. Da a la cuenta de servicio de Cloud Run permiso de lectura solo sobre esos secretos.
3. Despliega `routes-api` y `endorse-api` con `--source`. Las migraciones de BD corren al arrancar (`DB_RUN_MIGRATIONS=true`) y son idempotentes.
4. Despliega el `frontend` inyectándole las URLs de las APIs en runtime (`config.js`).
5. Restringe el `CORS_ORIGINS` de las APIs a la URL del frontend.

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
