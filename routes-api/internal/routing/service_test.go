package routing

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"routes-api/internal/graph"
)

type stubProvider struct {
	g     graph.Graph
	err   error
	calls int
}

func (s *stubProvider) DefaultGraph(context.Context) (graph.Graph, error) {
	s.calls++
	return s.g, s.err
}

var limaMini = graph.Graph{
	"Miraflores": {"San Isidro": 7},
	"Ate":        {"San Isidro": 20},
}

func TestOptimalRouteUsesRequestGraph(t *testing.T) {
	p := &stubProvider{}
	route, err := NewService(p).OptimalRoute(context.Background(), Request{
		AccidentLocation: "San Isidro",
		Depots:           []string{"Ate", "Miraflores"},
		Graph:            limaMini,
	})
	if err != nil || route.Source != "Miraflores" || route.Distance != 7 {
		t.Fatalf("got %+v, %v", route, err)
	}
	if p.calls != 0 {
		t.Fatal("no debía consultar el grafo por defecto")
	}
}

func TestOptimalRouteFallsBackToDefaultGraphAndTrims(t *testing.T) {
	p := &stubProvider{g: limaMini}
	route, err := NewService(p).OptimalRoute(context.Background(), Request{
		AccidentLocation: "  San Isidro ",
		Depots:           []string{" Ate ", "", "Miraflores"},
	})
	if err != nil || route.Source != "Miraflores" {
		t.Fatalf("got %+v, %v", route, err)
	}
	if p.calls != 1 {
		t.Fatalf("calls = %d", p.calls)
	}
}

func TestOptimalRoutePropagatesProviderError(t *testing.T) {
	boom := errors.New("sin grafo")
	_, err := NewService(&stubProvider{err: boom}).OptimalRoute(context.Background(), Request{
		AccidentLocation: "X", Depots: []string{"Y"},
	})
	if !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}

func TestFileGraphProvider(t *testing.T) {
	dir := t.TempDir()
	write := func(name, content string) string {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		return p
	}

	t.Run("carga el grafo real del repo y devuelve copias independientes", func(t *testing.T) {
		p, err := NewFileGraphProvider("../../data/lima-graph.json")
		if err != nil {
			t.Fatal(err)
		}
		g1, _ := p.DefaultGraph(context.Background())
		g1["Miraflores"]["San Isidro"] = 999
		g2, _ := NewService(p).DefaultGraph(context.Background())
		if g2["Miraflores"]["San Isidro"] != 7 {
			t.Fatal("el grafo compartido fue mutado")
		}
		route, err := NewService(p).OptimalRoute(context.Background(), Request{
			AccidentLocation: "San Isidro", Depots: []string{"Miraflores", "Ate"},
		})
		if err != nil || route.Source != "Miraflores" || route.Distance != 7 {
			t.Fatalf("got %+v, %v", route, err)
		}
	})

	cases := map[string]string{
		"archivo inexistente": filepath.Join(dir, "nope.json"),
		"JSON inválido":       write("bad.json", "{"),
		"peso negativo":       write("neg.json", `{"A":{"B":-1}}`),
	}
	for name, path := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := NewFileGraphProvider(path); err == nil {
				t.Fatal("esperaba error")
			}
		})
	}
}
