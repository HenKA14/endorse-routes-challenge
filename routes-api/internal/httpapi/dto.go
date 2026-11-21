package httpapi

import "routes-api/internal/graph"

// OptimalRouteRequest es el contrato de entrada de POST /v1/routes/optimal.
// `graph` es opcional: si se omite se usa el grafo de Lima configurado.
type OptimalRouteRequest struct {
	AccidentLocation string      `json:"accidentLocation"`
	Depots           []string    `json:"depots"`
	Graph            graph.Graph `json:"graph,omitempty"`
}

// OptimalRouteResponse es el contrato de salida (idéntico al del enunciado).
type OptimalRouteResponse struct {
	FromDepot string   `json:"fromDepot"`
	To        string   `json:"to"`
	Path      []string `json:"path"`
	Distance  float64  `json:"distance"`
}

type TokenRequest struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

type TokenResponse struct {
	AccessToken string `json:"accessToken"`
	TokenType   string `json:"tokenType"`
	ExpiresIn   int    `json:"expiresIn"`
}

// ErrorResponse mantiene el mismo formato de error que el endorse-api.
type ErrorResponse struct {
	StatusCode int    `json:"statusCode"`
	Error      string `json:"error"`
	Message    string `json:"message"`
	Code       string `json:"code"`
}
