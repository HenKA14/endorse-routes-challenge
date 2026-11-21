// Package routing es la capa de servicio: orquesta el caso de uso "asignar la
// grúa más cercana" sobre el algoritmo del paquete graph.
package routing

import (
	"context"
	"strings"

	"routes-api/internal/graph"
)

// GraphProvider abstrae de dónde sale el grafo por defecto (archivo, BD,
// servicio de mapas...). Cambiar el grafo de Lima no toca la lógica (DIP/OCP).
type GraphProvider interface {
	DefaultGraph(ctx context.Context) (graph.Graph, error)
}

// Request es la entrada del caso de uso. Si Graph viene vacío se usa el grafo
// por defecto del provider.
type Request struct {
	AccidentLocation string
	Depots           []string
	Graph            graph.Graph
}

// Service calcula la ruta óptima base -> accidente.
type Service struct {
	provider GraphProvider
}

func NewService(provider GraphProvider) *Service {
	return &Service{provider: provider}
}

func (s *Service) OptimalRoute(ctx context.Context, req Request) (graph.Route, error) {
	g := req.Graph
	if len(g) == 0 {
		var err error
		if g, err = s.provider.DefaultGraph(ctx); err != nil {
			return graph.Route{}, err
		}
	}

	depots := make([]string, 0, len(req.Depots))
	for _, d := range req.Depots {
		if d = strings.TrimSpace(d); d != "" {
			depots = append(depots, d)
		}
	}

	return graph.NearestSource(g, depots, strings.TrimSpace(req.AccidentLocation))
}

// DefaultGraph expone el grafo por defecto (para que el frontend lo precargue).
func (s *Service) DefaultGraph(ctx context.Context) (graph.Graph, error) {
	return s.provider.DefaultGraph(ctx)
}
