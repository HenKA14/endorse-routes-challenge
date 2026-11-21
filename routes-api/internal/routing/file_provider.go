package routing

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"routes-api/internal/graph"
)

// FileGraphProvider carga el grafo desde un JSON al arrancar (fail-fast si es
// inválido). Para actualizar la red basta con cambiar el archivo o GRAPH_FILE.
type FileGraphProvider struct {
	g graph.Graph
}

func NewFileGraphProvider(path string) (*FileGraphProvider, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("leyendo grafo %s: %w", path, err)
	}
	var g graph.Graph
	if err := json.Unmarshal(raw, &g); err != nil {
		return nil, fmt.Errorf("parseando grafo %s: %w", path, err)
	}
	if err := g.Validate(); err != nil {
		return nil, fmt.Errorf("grafo %s: %w", path, err)
	}
	return &FileGraphProvider{g: g}, nil
}

// DefaultGraph devuelve una copia para que nadie mute el grafo compartido.
func (p *FileGraphProvider) DefaultGraph(context.Context) (graph.Graph, error) {
	cp := make(graph.Graph, len(p.g))
	for from, edges := range p.g {
		e := make(map[string]float64, len(edges))
		for to, w := range edges {
			e[to] = w
		}
		cp[from] = e
	}
	return cp, nil
}
