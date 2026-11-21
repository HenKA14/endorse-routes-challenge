package graph

import (
	"container/heap"
	"fmt"
)

// Route es el camino mínimo encontrado desde la fuente más cercana.
type Route struct {
	Source   string
	Target   string
	Path     []string
	Distance float64
}

// NearestSource calcula, con un Dijkstra multi-fuente, cuál de las fuentes
// (bases de grúas) está más cerca del destino y el camino mínimo desde ella.
//
// En lugar de ejecutar Dijkstra una vez por base (O(k·(V+E)·log V)), todas las
// bases entran a la cola con distancia 0 y se expande como si hubiera un
// "super-origen" conectado a ellas: una sola pasada O((V+E)·log V). Además se
// corta en cuanto el destino sale de la cola (su distancia ya es definitiva).
//
// Se recorre en el sentido real del viaje (base -> accidente), por lo que es
// correcto también para grafos dirigidos/asimétricos (calles de un sentido).
//
// Empates: a igual distancia gana la base que aparece primero en `sources`,
// y luego el camino con menos saltos; el resultado es determinista.
func NearestSource(g Graph, sources []string, target string) (Route, error) {
	if err := g.Validate(); err != nil {
		return Route{}, err
	}
	if len(sources) == 0 {
		return Route{}, ErrNoSources
	}
	if !g.HasNode(target) {
		return Route{}, fmt.Errorf("%w: ubicación del accidente %q", ErrUnknownNode, target)
	}

	best := make(map[string]label, len(g))
	prev := make(map[string]string, len(g))
	pq := &priorityQueue{}

	for rank, s := range sources {
		if !g.HasNode(s) {
			return Route{}, fmt.Errorf("%w: base %q", ErrUnknownNode, s)
		}
		if _, seen := best[s]; seen {
			continue // base duplicada: conserva el primer rank
		}
		l := label{dist: 0, rank: rank, hops: 0}
		best[s] = l
		heap.Push(pq, &item{node: s, label: l})
	}

	settled := make(map[string]bool, len(g))
	for pq.Len() > 0 {
		cur := heap.Pop(pq).(*item)
		if settled[cur.node] || cur.label != best[cur.node] {
			continue // entrada obsoleta (lazy deletion)
		}
		settled[cur.node] = true

		if cur.node == target {
			return Route{
				Source:   sources[cur.label.rank],
				Target:   target,
				Path:     buildPath(prev, target),
				Distance: cur.label.dist,
			}, nil
		}

		for next, w := range g[cur.node] {
			if settled[next] {
				continue
			}
			candidate := label{dist: cur.label.dist + w, rank: cur.label.rank, hops: cur.label.hops + 1}
			if old, ok := best[next]; !ok || candidate.less(old) {
				best[next] = candidate
				prev[next] = cur.node
				heap.Push(pq, &item{node: next, label: candidate})
			}
		}
	}

	return Route{}, fmt.Errorf("%w: %q", ErrUnreachable, target)
}

func buildPath(prev map[string]string, target string) []string {
	path := []string{target}
	for node := target; ; {
		p, ok := prev[node]
		if !ok {
			break
		}
		path = append(path, p)
		node = p
	}
	for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
		path[i], path[j] = path[j], path[i]
	}
	return path
}

// label ordena candidatos: distancia, luego base preferida, luego menos saltos.
type label struct {
	dist float64
	rank int
	hops int
}

func (a label) less(b label) bool {
	if a.dist != b.dist {
		return a.dist < b.dist
	}
	if a.rank != b.rank {
		return a.rank < b.rank
	}
	return a.hops < b.hops
}

type item struct {
	node  string
	label label
}

// priorityQueue implementa heap.Interface (min-heap por label).
type priorityQueue []*item

func (pq priorityQueue) Len() int { return len(pq) }
func (pq priorityQueue) Less(i, j int) bool {
	if pq[i].label != pq[j].label {
		return pq[i].label.less(pq[j].label)
	}
	return pq[i].node < pq[j].node
}
func (pq priorityQueue) Swap(i, j int) { pq[i], pq[j] = pq[j], pq[i] }
func (pq *priorityQueue) Push(x any)   { *pq = append(*pq, x.(*item)) }
func (pq *priorityQueue) Pop() any {
	old := *pq
	n := len(old)
	it := old[n-1]
	old[n-1] = nil
	*pq = old[:n-1]
	return it
}
