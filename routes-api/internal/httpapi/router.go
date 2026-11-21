package httpapi

import (
	"net/http"

	"routes-api/internal/auth"
)

// NewRouter registra las rutas. El versionado va en el path (/v1); una v2
// convivirá registrando "/v2/..." con sus propios handlers.
func NewRouter(h *Handler, verifier TokenVerifier, corsOrigins []string) http.Handler {
	protected := RequireJWT(verifier, auth.ScopeRoutes)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("POST /v1/auth/token", h.Token)
	mux.Handle("POST /v1/routes/optimal", protected(http.HandlerFunc(h.OptimalRoute)))
	mux.Handle("GET /v1/graph", protected(http.HandlerFunc(h.DefaultGraph)))

	return Chain(mux, WithRecover, WithRequestID, WithLogging, WithSecurityHeaders, WithCORS(corsOrigins))
}
