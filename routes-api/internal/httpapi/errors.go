package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"routes-api/internal/auth"
	"routes-api/internal/graph"
)

// errorMapping traduce errores de dominio a HTTP. Nuevo error = nueva fila.
var errorMapping = []struct {
	target error
	status int
	code   string
}{
	{graph.ErrUnreachable, http.StatusUnprocessableEntity, "ACCIDENT_UNREACHABLE"},
	{graph.ErrUnknownNode, http.StatusUnprocessableEntity, "UNKNOWN_NODE"},
	{graph.ErrInvalidGraph, http.StatusBadRequest, "INVALID_GRAPH"},
	{graph.ErrEmptyGraph, http.StatusBadRequest, "EMPTY_GRAPH"},
	{graph.ErrNoSources, http.StatusBadRequest, "NO_DEPOTS"},
	{auth.ErrInvalidCredentials, http.StatusUnauthorized, "INVALID_CREDENTIALS"},
	{auth.ErrInvalidToken, http.StatusUnauthorized, "INVALID_TOKEN"},
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, ErrorResponse{
		StatusCode: status,
		Error:      http.StatusText(status),
		Message:    message,
		Code:       code,
	})
}

// writeDomainError responde según la tabla; lo no mapeado es 500 sin detalles.
func writeDomainError(w http.ResponseWriter, r *http.Request, err error) {
	for _, m := range errorMapping {
		if errors.Is(err, m.target) {
			writeError(w, m.status, m.code, err.Error())
			return
		}
	}
	slog.ErrorContext(r.Context(), "error no controlado", "error", err, "requestId", RequestID(r.Context()))
	writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Error interno")
}
