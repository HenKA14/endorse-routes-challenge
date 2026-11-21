package graph

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"reflect"
	"testing"
)

// pdfGraph es el grafo del enunciado.
func pdfGraph() Graph {
	return Graph{
		"Miraflores": {"San Isidro": 7, "Barranco": 3},
		"San Isidro": {"Miraflores": 7, "Lince": 4},
		"Barranco":   {"Miraflores": 3, "Surco": 5},
		"Lince":      {"San Isidro": 4, "Surco": 6},
		"Surco":      {"Barranco": 5, "Lince": 6, "Ate": 10},
		"Ate":        {"Surco": 10},
	}
}

func TestNearestSource(t *testing.T) {
	tests := []struct {
		name    string
		graph   Graph
		sources []string
		target  string
		want    Route
	}{
		{
			name:    "ejemplo del enunciado",
			graph:   pdfGraph(),
			sources: []string{"Miraflores", "Ate"},
			target:  "San Isidro",
			want:    Route{Source: "Miraflores", Target: "San Isidro", Path: []string{"Miraflores", "San Isidro"}, Distance: 7},
		},
		{
			name:    "la base más cercana no es la primera de la lista",
			graph:   pdfGraph(),
			sources: []string{"Miraflores", "Ate"},
			target:  "Surco",
			want:    Route{Source: "Miraflores", Target: "Surco", Path: []string{"Miraflores", "Barranco", "Surco"}, Distance: 8},
		},
		{
			name:    "gana la segunda base",
			graph:   pdfGraph(),
			sources: []string{"San Isidro", "Ate"},
			target:  "Barranco",
			// San Isidro -> Miraflores -> Barranco = 10; Ate -> Surco -> Barranco = 15
			want: Route{Source: "San Isidro", Target: "Barranco", Path: []string{"San Isidro", "Miraflores", "Barranco"}, Distance: 10},
		},
		{
			name:    "camino de varios saltos más corto que la arista directa",
			graph:   Graph{"A": {"B": 10, "C": 1}, "C": {"D": 1}, "D": {"B": 1}},
			sources: []string{"A"},
			target:  "B",
			want:    Route{Source: "A", Target: "B", Path: []string{"A", "C", "D", "B"}, Distance: 3},
		},
		{
			name:    "el accidente ocurre en una base",
			graph:   pdfGraph(),
			sources: []string{"Ate", "Lince"},
			target:  "Lince",
			want:    Route{Source: "Lince", Target: "Lince", Path: []string{"Lince"}, Distance: 0},
		},
		{
			name:    "empate de distancia: gana la base listada primero",
			graph:   Graph{"A": {"X": 5}, "B": {"X": 5}},
			sources: []string{"B", "A"},
			target:  "X",
			want:    Route{Source: "B", Target: "X", Path: []string{"B", "X"}, Distance: 5},
		},
		{
			name:    "empate de distancia en la misma base: menos saltos",
			graph:   Graph{"A": {"X": 4, "M": 2}, "M": {"X": 2}},
			sources: []string{"A"},
			target:  "X",
			want:    Route{Source: "A", Target: "X", Path: []string{"A", "X"}, Distance: 4},
		},
		{
			name:    "grafo dirigido: respeta el sentido base -> accidente",
			graph:   Graph{"Base1": {"X": 1}, "X": {"Base2": 1}, "Base2": {"Y": 50}, "Y": {"X": 50}},
			sources: []string{"Base2", "Base1"},
			target:  "X",
			want:    Route{Source: "Base1", Target: "X", Path: []string{"Base1", "X"}, Distance: 1},
		},
		{
			name:    "pesos decimales y aristas de peso cero",
			graph:   Graph{"A": {"B": 0, "C": 2.5}, "B": {"C": 1.25}},
			sources: []string{"A"},
			target:  "C",
			want:    Route{Source: "A", Target: "C", Path: []string{"A", "B", "C"}, Distance: 1.25},
		},
		{
			name:    "nodo destino sin aristas salientes y bases duplicadas",
			graph:   Graph{"A": {"Z": 3}},
			sources: []string{"A", "A"},
			target:  "Z",
			want:    Route{Source: "A", Target: "Z", Path: []string{"A", "Z"}, Distance: 3},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := NearestSource(tc.graph, tc.sources, tc.target)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestNearestSourceErrors(t *testing.T) {
	tests := []struct {
		name    string
		graph   Graph
		sources []string
		target  string
		wantErr error
	}{
		{"accidente inalcanzable", Graph{"A": {"B": 1}, "C": {"D": 1}}, []string{"A"}, "D", ErrUnreachable},
		{"inalcanzable por sentido de las aristas", Graph{"X": {"Base": 1}}, []string{"Base"}, "X", ErrUnreachable},
		{"accidente inexistente", pdfGraph(), []string{"Ate"}, "Callao", ErrUnknownNode},
		{"base inexistente", pdfGraph(), []string{"Ate", "Callao"}, "Lince", ErrUnknownNode},
		{"sin bases", pdfGraph(), nil, "Lince", ErrNoSources},
		{"grafo vacío", Graph{}, []string{"A"}, "B", ErrEmptyGraph},
		{"peso negativo", Graph{"A": {"B": -1}}, []string{"A"}, "B", ErrInvalidGraph},
		{"peso infinito", Graph{"A": {"B": math.Inf(1)}}, []string{"A"}, "B", ErrInvalidGraph},
		{"peso NaN", Graph{"A": {"B": math.NaN()}}, []string{"A"}, "B", ErrInvalidGraph},
		{"auto-arista", Graph{"A": {"A": 1}}, []string{"A"}, "A", ErrInvalidGraph},
		{"nodo vacío", Graph{"": {"A": 1}}, []string{"A"}, "A", ErrInvalidGraph},
		{"destino vacío", Graph{"A": {"": 1}}, []string{"A"}, "A", ErrInvalidGraph},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NearestSource(tc.graph, tc.sources, tc.target)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("got %v, want %v", err, tc.wantErr)
			}
		})
	}
}

// TestNearestSourceMatchesBruteForce compara contra Floyd–Warshall en grafos
// aleatorios: misma distancia mínima y un camino válido de ese costo.
func TestNearestSourceMatchesBruteForce(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	for iter := 0; iter < 300; iter++ {
		n := 2 + rng.Intn(25)
		g := randomGraph(rng, n, 0.15+rng.Float64()*0.3)
		nodes := g.Nodes()
		if len(nodes) < 2 {
			continue
		}
		target := nodes[rng.Intn(len(nodes))]
		sources := []string{nodes[rng.Intn(len(nodes))], nodes[rng.Intn(len(nodes))]}

		dist := floydWarshall(g, nodes)
		want := math.Inf(1)
		for _, s := range sources {
			want = math.Min(want, dist[s][target])
		}

		got, err := NearestSource(g, sources, target)
		if math.IsInf(want, 1) {
			if !errors.Is(err, ErrUnreachable) {
				t.Fatalf("iter %d: esperaba inalcanzable, got %+v %v", iter, got, err)
			}
			continue
		}
		if err != nil {
			t.Fatalf("iter %d: error inesperado %v", iter, err)
		}
		if math.Abs(got.Distance-want) > 1e-9 {
			t.Fatalf("iter %d: distancia %v, want %v", iter, got.Distance, want)
		}
		if cost := pathCost(t, g, got.Path); math.Abs(cost-got.Distance) > 1e-9 {
			t.Fatalf("iter %d: el camino %v cuesta %v pero se reportó %v", iter, got.Path, cost, got.Distance)
		}
		if got.Path[0] != got.Source || got.Path[len(got.Path)-1] != target {
			t.Fatalf("iter %d: extremos incorrectos en %v", iter, got.Path)
		}
	}
}

func randomGraph(rng *rand.Rand, n int, density float64) Graph {
	g := Graph{}
	for i := 0; i < n; i++ {
		for j := 0; j < n; j++ {
			if i != j && rng.Float64() < density {
				from, to := fmt.Sprintf("N%d", i), fmt.Sprintf("N%d", j)
				if g[from] == nil {
					g[from] = map[string]float64{}
				}
				g[from][to] = float64(rng.Intn(20))
			}
		}
	}
	return g
}

func floydWarshall(g Graph, nodes []string) map[string]map[string]float64 {
	d := map[string]map[string]float64{}
	for _, a := range nodes {
		d[a] = map[string]float64{}
		for _, b := range nodes {
			d[a][b] = math.Inf(1)
		}
		d[a][a] = 0
	}
	for from, edges := range g {
		for to, w := range edges {
			d[from][to] = math.Min(d[from][to], w)
		}
	}
	for _, k := range nodes {
		for _, i := range nodes {
			for _, j := range nodes {
				if d[i][k]+d[k][j] < d[i][j] {
					d[i][j] = d[i][k] + d[k][j]
				}
			}
		}
	}
	return d
}

func pathCost(t *testing.T, g Graph, path []string) float64 {
	t.Helper()
	cost := 0.0
	for i := 0; i+1 < len(path); i++ {
		w, ok := g[path[i]][path[i+1]]
		if !ok {
			t.Fatalf("el camino usa una arista inexistente %s -> %s", path[i], path[i+1])
		}
		cost += w
	}
	return cost
}

// BenchmarkNearestSource mide un grafo tipo malla de 10.000 nodos con 5 bases.
func BenchmarkNearestSource(b *testing.B) {
	const side = 100
	g := Graph{}
	name := func(r, c int) string { return fmt.Sprintf("%d-%d", r, c) }
	for r := 0; r < side; r++ {
		for c := 0; c < side; c++ {
			edges := map[string]float64{}
			if r+1 < side {
				edges[name(r+1, c)] = 1
			}
			if c+1 < side {
				edges[name(r, c+1)] = 2
			}
			if r > 0 {
				edges[name(r-1, c)] = 1
			}
			if c > 0 {
				edges[name(r, c-1)] = 2
			}
			g[name(r, c)] = edges
		}
	}
	sources := []string{name(0, 0), name(0, 99), name(99, 0), name(99, 99), name(10, 10)}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := NearestSource(g, sources, name(50, 50)); err != nil {
			b.Fatal(err)
		}
	}
}
