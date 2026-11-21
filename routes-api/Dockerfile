# syntax=docker/dockerfile:1.7

# --- Build: binario estático (sin CGO) ---
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/routes-api ./cmd/server

# --- Runtime: distroless sin shell, usuario nonroot (~10 MB) ---
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/routes-api /app/routes-api
COPY data /app/data
ENV APP_ENV=production \
    PORT=8080 \
    GRAPH_FILE=/app/data/lima-graph.json
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/routes-api"]
