#!/usr/bin/env bash
# Despliegue en GCP Cloud Run (capa gratuita) + Postgres en Neon (free tier).
#
# No requiere Docker local: `gcloud run deploy --source` construye la imagen
# con Cloud Build usando el Dockerfile de cada servicio y la sube a Artifact
# Registry.
#
# Requisitos: gcloud autenticado (gcloud auth login), proyecto con billing
# habilitado (Cloud Run lo exige aunque se quede en el free tier) y la cadena de
# conexión de Neon.
#
# Uso (las variables pueden ir en un archivo .env.deploy en la raíz del repo,
# que está en .gitignore, para no escribir la contraseña de Neon en la terminal):
#   GCP_PROJECT=mi-proyecto
#   NEON_DATABASE_URL='postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require'
#   ./scripts/deploy-gcp.sh
#
# Para mantenerse en la capa gratuita: escala a cero, máximo 2 instancias,
# solo la última versión de cada secreto (límite gratis: 6 versiones activas) y
# limpieza de imágenes viejas en Artifact Registry (límite gratis: 0,5 GB).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env.deploy" ]]; then
  set -a; source "$ROOT/.env.deploy"; set +a
fi

: "${GCP_PROJECT:?Define GCP_PROJECT}"
: "${NEON_DATABASE_URL:?Define NEON_DATABASE_URL (cadena de conexión de Neon)}"
REGION="${GCP_REGION:-us-central1}"
CLIENT_ID="${AUTH_CLIENT_ID:-frontend-demo}"

gcloud config set project "$GCP_PROJECT" >/dev/null

echo "==> Habilitando APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

# Crea el secreto si no existe; si existe, agrega una versión nueva.
upsert_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy=automatic --data-file=- >/dev/null
  fi
  # Destruye las versiones anteriores: solo la última cuenta como activa.
  gcloud secrets versions list "$name" --filter='state!=DESTROYED' --sort-by=~createTime \
    --format='value(name.basename())' | tail -n +2 | while read -r v; do
    gcloud secrets versions destroy "$v" --secret="$name" --quiet >/dev/null
  done
}

echo "==> Secretos en Secret Manager"
gcloud secrets describe endorse-jwt-secret >/dev/null 2>&1 || upsert_secret endorse-jwt-secret "$(openssl rand -hex 32)"
gcloud secrets describe routes-jwt-secret  >/dev/null 2>&1 || upsert_secret routes-jwt-secret  "$(openssl rand -hex 32)"
gcloud secrets describe client-secret      >/dev/null 2>&1 || upsert_secret client-secret      "$(openssl rand -hex 16)"
upsert_secret endorse-database-url "$NEON_DATABASE_URL"

# La cuenta de servicio por defecto de Cloud Run necesita leer los secretos.
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT" --format='value(projectNumber)')"
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for s in endorse-jwt-secret routes-jwt-secret client-secret endorse-database-url; do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:${RUN_SA}" \
    --role=roles/secretmanager.secretAccessor >/dev/null
done

# Flags comunes: escala a cero (costo 0 sin tráfico) y tope de instancias.
COMMON=(--region "$REGION" --allow-unauthenticated --min-instances 0 --max-instances 2 --cpu 1 --memory 256Mi --quiet)

echo "==> routes-api (Go)"
gcloud run deploy routes-api --source "$ROOT/routes-api" "${COMMON[@]}" \
  --set-env-vars "APP_ENV=production,AUTH_CLIENT_ID=${CLIENT_ID}" \
  --set-secrets "JWT_SECRET=routes-jwt-secret:latest,AUTH_CLIENT_SECRET=client-secret:latest"
ROUTES_URL="$(gcloud run services describe routes-api --region "$REGION" --format='value(status.url)')"

echo "==> endorse-api (Node + Hapi)"
gcloud run deploy endorse-api --source "$ROOT/endorse-api" "${COMMON[@]}" --memory 512Mi \
  --set-env-vars "NODE_ENV=production,DB_SSL=true,DB_RUN_MIGRATIONS=true,AUTH_CLIENT_ID=${CLIENT_ID}" \
  --set-secrets "DATABASE_URL=endorse-database-url:latest,JWT_SECRET=endorse-jwt-secret:latest,AUTH_CLIENT_SECRET=client-secret:latest"
ENDORSE_URL="$(gcloud run services describe endorse-api --region "$REGION" --format='value(status.url)')"

echo "==> frontend (Vue + nginx)"
CLIENT_SECRET_VALUE="$(gcloud secrets versions access latest --secret=client-secret)"
gcloud run deploy frontend --source "$ROOT/frontend" "${COMMON[@]}" --memory 128Mi \
  --set-env-vars "ENDORSE_API_URL=${ENDORSE_URL},ROUTES_API_URL=${ROUTES_URL},CLIENT_ID=${CLIENT_ID},CLIENT_SECRET=${CLIENT_SECRET_VALUE}"
FRONTEND_URL="$(gcloud run services describe frontend --region "$REGION" --format='value(status.url)')"

echo "==> CORS: las APIs solo aceptan el origen del frontend"
for svc in routes-api endorse-api; do
  gcloud run services update "$svc" --region "$REGION" --update-env-vars "CORS_ORIGINS=${FRONTEND_URL}" --quiet >/dev/null
done

echo "==> Artifact Registry: conservar solo las 2 imágenes más recientes por servicio"
POLICY_FILE="$(mktemp)"
cat > "$POLICY_FILE" <<'JSON'
[
  {"name": "keep-recent", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 2}},
  {"name": "delete-old", "action": {"type": "Delete"}, "condition": {"tagState": "ANY", "olderThan": "1d"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy \
  --location "$REGION" --policy "$POLICY_FILE" --no-dry-run --quiet >/dev/null
rm -f "$POLICY_FILE"

cat <<EOF

Despliegue completo
  Frontend     ${FRONTEND_URL}
  Endorse API  ${ENDORSE_URL}   (Swagger: ${ENDORSE_URL}/documentation)
  Routes API   ${ROUTES_URL}
EOF
