# Reto técnico Interseguro · Software Architect

Monorepo con los tres ejercicios del reto:

| Carpeta | Ejercicio | Stack |
|---|---|---|
| [`endorse-api/`](endorse-api) | 1 · Servicio traductor de endosos | Node 22 · Hapi 21 · TypeORM · PostgreSQL · Jest |
| [`routes-api/`](routes-api) | 2 · Rutas óptimas de grúas | Go 1.23+ · `net/http` · Dijkstra multi-fuente |
| [`frontend/`](frontend) | 1 y 2 · Frontend | Vue 3 · Vite · TypeScript · Vitest |
| [`architecture/`](architecture) + [`docs/ARQUITECTURA-PRESTAMOS.md`](docs/ARQUITECTURA-PRESTAMOS.md) | 3 · Arquitectura de préstamos | draw.io (AS IS + TO BE) |

Más documentación: [Modelo de datos (ER)](docs/ER.md) · [Despliegue](docs/DEPLOY.md)

## Demo en vivo

**https://endorse-routes-challenge.netlify.app**

| Servicio | URL | Plataforma |
|---|---|---|
| Frontend | https://endorse-routes-challenge.netlify.app | Netlify |
| Endorse API | https://endorse-api.onrender.com ([Swagger](https://endorse-api.onrender.com/documentation)) | Render + Neon |
| Routes API | https://routes-api-zbxi.onrender.com | Render |

Para probarla, usa **"Cargar ejemplo del enunciado"** en cada pantalla y luego **Traducir** o **Calcular ruta**.

> Las APIs están en el plan gratuito de Render y se duermen tras 15 minutos sin tráfico. La primera petición puede tardar hasta cerca de un minuto; las siguientes responden normal.

---

## Ejecutar en local

Requisitos: Node 22 (`.nvmrc`), Go ≥ 1.23 y PostgreSQL 16.

```bash
createdb endorse_db
```

**Endorse API** (http://localhost:3000, Swagger en `/documentation`):

```bash
cd endorse-api && cp .env.example .env && npm ci && npm run db:migrate && npm run dev
```

**Routes API** (http://localhost:8080):

```bash
cd routes-api && go run ./cmd/server
```

**Frontend** (http://localhost:5173):

```bash
cd frontend && cp .env.example .env && npm ci && npm run dev
```

Con Docker, todo junto (Postgres incluido):

```bash
docker compose up --build
```

### Tests

```bash
cd endorse-api && TEST_DATABASE_URL=postgres://localhost:5432/endorse_test npm run test:coverage
```

```bash
cd routes-api && go test -race -cover ./... && go test ./internal/graph -bench . -run ^$
```

```bash
cd frontend && npm test
```

| Proyecto | Tests | Cobertura |
|---|---|---|
| endorse-api | 78 (unitarios + HTTP con `server.inject` + integración con Postgres real) | 97,5 % líneas · 85,8 % ramas |
| routes-api | algoritmo (tabla, 300 grafos aleatorios contra Floyd–Warshall, benchmark), servicio, auth, HTTP | 100 % graph/routing/auth, 98,5 % httpapi |
| frontend | 24 (cliente HTTP con caché y renovación de JWT, validadores, anti-XSS del visor) | — |

El CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre las tres suites y construye las tres imágenes Docker.

---

## Ejercicio 1 · Traductor de endosos

```
POST /v1/endorse/translate   (JWT, scope endorse:translate)
GET  /v1/templates           (JWT) plantillas activas y campos que consume cada una
POST /v1/auth/token          client credentials → JWT
GET  /health                 liveness/readiness (incluye ping a BD)
```

### Capas (según la arquitectura de referencia)
```
src/
├── routes/v1/        Routes      · contrato HTTP, validación Joi, versionado por prefijo /v1
├── controllers/      Controller  · adapta HTTP ↔ servicio (sin lógica de negocio)
├── services/         Service     · EndorseTranslatorService, ValueResolver, TemplateService, AuthService
├── entities/         Entity/DTO  · TranslateRequestDto, TemplateConfig, CoreEndorsementDto
├── mappers/          Mapper      · Model → TemplateConfig; valores resueltos → JSON del core
├── repositories/     Repository  · interfaz TemplateRepository + implementación TypeORM
├── models/           Model       · entidades TypeORM (tablas)
├── database/         migraciones SQL explícitas + seed de plantillas
├── plugins/          JWT, mapeo de errores de dominio → HTTP, Swagger
└── container.ts      composition root (inyección de dependencias manual)
```
Capas omitidas a propósito (el reto pide usar "solo las necesarias"): **Integration** (no hay APIs externas) y **Publisher** (no hay procesamiento asíncrono).

### Cómo funciona la traducción
La plantilla (producto + tipo de endoso) se guarda en BD como datos:
- **`output_layout_field`**: el esqueleto del JSON del core. Cada fila dice "escribe en `riskUnitEntities[0].plansEntity.description` el valor de `input.plan`". El `sort_order` fija el orden de las claves.
- **`template_dynamic_field`**: etiquetas de `dynamicData` con su orden, campo de origen y valor por defecto.
- **`template_event`**: la lista ordenada de `eventAppliedEntities`.

Todos los campos siguen **una sola regla**: el valor de entrada, si no viene el default, si no hay default y es obligatorio se reporta como faltante, y si no es `null`. El servicio no contiene ningún `if producto === ...`: un producto nuevo es solo un `INSERT` ([ejemplo en docs/ER.md](docs/ER.md#agregar-un-producto-o-tipo-de-endoso-nuevo-sin-desplegar-código)).

El test principal comprueba que la salida del ejemplo del enunciado sea **idéntica byte a byte**, orden de claves incluido.

### Validaciones y errores
| Caso | Respuesta |
|---|---|
| JSON no plano, tipos inválidos, faltan `producto`/`tipoEndoso` | `400` con el detalle de Joi |
| Sin token, token inválido o expirado | `401` |
| No hay plantilla activa para producto + tipo | `404 TEMPLATE_NOT_FOUND` |
| Faltan campos requeridos por la plantilla | `422 MISSING_REQUIRED_FIELDS` con **todos** los faltantes y dónde se iban a usar |
| Plantilla mal configurada en BD (ruta inválida, campo sin origen) | `500 INVALID_TEMPLATE_CONFIG`, sin exponer detalles internos |

### SOLID y patrones
- **S**: resolver valores (`ValueResolver`), construir el JSON (`CorePayloadMapper`) y orquestar (`EndorseTranslatorService`) son clases separadas.
- **O**: productos y endosos nuevos se agregan con datos. Los errores nuevos son una fila en la tabla de mapeo de errores.
- **L/I**: `TemplateRepository` es una interfaz mínima, que en los tests se reemplaza por una versión en memoria.
- **D**: los servicios dependen de interfaces y se ensamblan en `container.ts`.
- Patrones: Repository, DTO, Mapper, Template/Strategy por datos, Composition Root.

---

## Ejercicio 2 · Rutas óptimas

```
POST /v1/routes/optimal   (JWT, scope routes:calculate)   body: { accidentLocation, depots, graph? }
GET  /v1/graph            (JWT) grafo de Lima configurado
POST /v1/auth/token · GET /health
```

- **Dijkstra multi-fuente**: todas las bases entran a la cola con distancia 0 (como un "super-origen") y se corta en cuanto el accidente sale de la cola. Es **una sola pasada** O((V+E) log V), en vez de un Dijkstra por base. Un benchmark en una malla de 10.000 nodos resuelve en unos 3,4 ms.
- Recorre en el **sentido real del viaje** (base → accidente), así que es correcto en grafos dirigidos (calles de un sentido).
- **Desempates deterministas**: a igual distancia gana la base listada primero, y después la ruta con menos saltos.
- **Extensibilidad**: el algoritmo no conoce Lima. El grafo llega en el request o lo da un `GraphProvider` (hoy un JSON, [data/lima-graph.json](routes-api/data/lima-graph.json); mañana una BD o un servicio de mapas) sin tocar la lógica.
- **Errores controlados**:
  - `422 ACCIDENT_UNREACHABLE`
  - `422 UNKNOWN_NODE`
  - `400 INVALID_GRAPH` (pesos negativos, NaN o Inf, auto-aristas)
  - `400 INVALID_PAYLOAD` (campos desconocidos, cuerpo mayor a 1 MiB, JSON con basura al final)
- Capas: `cmd/server` (composition root) → `internal/httpapi` (handlers y middleware) → `internal/routing` (servicio) → `internal/graph` (dominio puro).

---

## Seguridad (ambas APIs)

- **JWT HS256** validado en el código: firma, `exp`, `aud`, `iss` y scopes por ruta. Se aceptan solo los algoritmos permitidos (protege contra `alg=none` y confusión de algoritmo). Los secretos se comparan en tiempo constante.
- Secretos por variables de entorno, inyectados desde **Secret Manager** en Cloud Run. En producción el servicio **no arranca** si falta un secreto o si el JWT_SECRET tiene menos de 32 caracteres.
- **CORS** restringido al origen del frontend. Cabeceras de seguridad (HSTS, nosniff, frame-deny). Límite de tamaño de payload. Errores 5xx sin detalles internos. Bloqueo de *prototype pollution* en las rutas de plantilla.
- Frontend: CSP estricta en nginx, `connect-src` limitado a las dos APIs y visor JSON con escape anti-XSS.

> **Trade-off consciente**: para la demo, el SPA usa *client credentials* contra `/v1/auth/token`, y en un SPA esas credenciales son públicas. En producción el emisor sería un IdP (Identity Platform, Auth0 o Cognito) con **OIDC + PKCE**, o un BFF, y las APIs validarían contra el JWKS. Otra opción es mover la validación a **API Gateway / Cloud Endpoints** ([docs/DEPLOY.md](docs/DEPLOY.md#alternativa-paas-para-la-seguridad)). El código de las APIs ya separa emisión y validación, así que el cambio es local.

## Despliegue

- **Despliegue objetivo: GCP Cloud Run** (las 3 apps) + **Neon** (Postgres gratis, porque Cloud SQL no tiene free tier) + Secret Manager. Un script hace todo y no requiere Docker local (usa Cloud Build): [scripts/deploy-gcp.sh](scripts/deploy-gcp.sh).
- **[Demo pública](https://endorse-routes-challenge.netlify.app): Netlify** (frontend) + **Render** (APIs, con los mismos Dockerfiles) + **Neon**, todo en planes gratuitos sin tarjeta: [netlify.toml](netlify.toml) y [render.yaml](render.yaml). En Render las APIs se duermen sin tráfico, así que la primera petición puede tardar cerca de un minuto.

Detalle y pasos en [docs/DEPLOY.md](docs/DEPLOY.md).
