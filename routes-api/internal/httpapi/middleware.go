package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"routes-api/internal/auth"
)

type ctxKey int

const (
	requestIDKey ctxKey = iota
	claimsKey
)

type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}

func ClaimsFrom(ctx context.Context) *auth.Claims {
	c, _ := ctx.Value(claimsKey).(*auth.Claims)
	return c
}

// WithRequestID propaga X-Request-Id (o genera uno) para trazabilidad.
func WithRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if id == "" || len(id) > 128 {
			b := make([]byte, 8)
			_, _ = rand.Read(b)
			id = hex.EncodeToString(b)
		}
		w.Header().Set("X-Request-Id", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// WithLogging registra cada petición en JSON (Cloud Logging lo indexa).
func WithLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.InfoContext(r.Context(), "request",
			"method", r.Method, "path", r.URL.Path, "status", rec.status,
			"latencyMs", time.Since(start).Milliseconds(), "requestId", RequestID(r.Context()))
	})
}

// WithRecover evita que un panic tumbe el proceso y responde 500.
func WithRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.ErrorContext(r.Context(), "panic", "panic", rec, "requestId", RequestID(r.Context()))
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Error interno")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func WithSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// WithCORS permite solo los orígenes configurados y resuelve el preflight.
func WithCORS(origins []string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && slices.Contains(origins, origin) {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Vary", "Origin")
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
				h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				h.Set("Access-Control-Expose-Headers", "X-Request-Id")
				h.Set("Access-Control-Max-Age", "600")
			}
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// TokenVerifier es lo único que el middleware necesita del servicio de auth.
type TokenVerifier interface {
	Verify(token string) (*auth.Claims, error)
}

// RequireJWT exige un Bearer válido con el scope indicado.
func RequireJWT(verifier TokenVerifier, scope string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !ok || raw == "" {
				w.Header().Set("WWW-Authenticate", `Bearer realm="routes-api"`)
				writeError(w, http.StatusUnauthorized, "MISSING_TOKEN", "Falta el header Authorization: Bearer <token>")
				return
			}
			claims, err := verifier.Verify(raw)
			if err != nil {
				w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
				writeError(w, http.StatusUnauthorized, "INVALID_TOKEN", "Token inválido o expirado")
				return
			}
			if !claims.HasScope(scope) {
				writeError(w, http.StatusForbidden, "INSUFFICIENT_SCOPE", "El token no tiene el scope "+scope)
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsKey, claims)))
		})
	}
}
