package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"routes-api/internal/graph"
	"routes-api/internal/routing"
)

const (
	maxBodyBytes = 1 << 20 // 1 MiB
	maxDepots    = 100
)

// RouteCalculator es lo que el handler necesita del servicio (ISP).
type RouteCalculator interface {
	OptimalRoute(ctx context.Context, req routing.Request) (graph.Route, error)
	DefaultGraph(ctx context.Context) (graph.Graph, error)
}

type TokenIssuer interface {
	Issue(clientID, clientSecret string) (string, error)
}

// Handler es la capa "controller": valida el contrato HTTP y delega.
type Handler struct {
	routes     RouteCalculator
	tokens     TokenIssuer
	ttlSeconds int
}

func NewHandler(routes RouteCalculator, tokens TokenIssuer, ttlSeconds int) *Handler {
	return &Handler{routes: routes, tokens: tokens, ttlSeconds: ttlSeconds}
}

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) Token(w http.ResponseWriter, r *http.Request) {
	var req TokenRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
		return
	}
	if req.ClientID == "" || req.ClientSecret == "" {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", "clientId y clientSecret son obligatorios")
		return
	}
	token, err := h.tokens.Issue(req.ClientID, req.ClientSecret)
	if err != nil {
		writeDomainError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, TokenResponse{AccessToken: token, TokenType: "Bearer", ExpiresIn: h.ttlSeconds})
}

func (h *Handler) OptimalRoute(w http.ResponseWriter, r *http.Request) {
	var req OptimalRouteRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", err.Error())
		return
	}
	if msg := validate(req); msg != "" {
		writeError(w, http.StatusBadRequest, "INVALID_PAYLOAD", msg)
		return
	}

	route, err := h.routes.OptimalRoute(r.Context(), routing.Request{
		AccidentLocation: req.AccidentLocation,
		Depots:           req.Depots,
		Graph:            req.Graph,
	})
	if err != nil {
		writeDomainError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, OptimalRouteResponse{
		FromDepot: route.Source,
		To:        route.Target,
		Path:      route.Path,
		Distance:  route.Distance,
	})
}

func (h *Handler) DefaultGraph(w http.ResponseWriter, r *http.Request) {
	g, err := h.routes.DefaultGraph(r.Context())
	if err != nil {
		writeDomainError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"nodes": g.Nodes(), "graph": g})
}

func validate(req OptimalRouteRequest) string {
	switch {
	case strings.TrimSpace(req.AccidentLocation) == "":
		return "accidentLocation es obligatorio"
	case len(req.Depots) == 0:
		return "depots debe tener al menos una base"
	case len(req.Depots) > maxDepots:
		return fmt.Sprintf("depots admite como máximo %d bases", maxDepots)
	}
	return ""
}

// decodeJSON aplica límite de tamaño, rechaza campos desconocidos y basura final.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return fmt.Errorf("el cuerpo supera %d bytes", maxBodyBytes)
		}
		if errors.Is(err, io.EOF) {
			return errors.New("el cuerpo de la petición está vacío")
		}
		return fmt.Errorf("JSON inválido: %v", err)
	}
	if dec.More() {
		return errors.New("JSON inválido: contenido adicional tras el objeto")
	}
	return nil
}
