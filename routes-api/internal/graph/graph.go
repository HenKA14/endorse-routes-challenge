// Package graph contiene el modelo de red vial (distritos = nodos, distancias =
// pesos) y el algoritmo de camino mínimo. No conoce HTTP ni Lima: cualquier
// grafo dirigido con pesos no negativos sirve.
package graph

import (
	"fmt"
	"math"
	"sort"
)

// Graph es una lista de adyacencia dirigida: Graph["A"]["B"] = peso de A -> B.
// Para calles de doble sentido se declaran ambas aristas (como en el ejemplo).
type Graph map[string]map[string]float64

// Nodes devuelve todos los nodos (los que tienen aristas salientes y los que
// solo aparecen como destino), ordenados para resultados deterministas.
func (g Graph) Nodes() []string {
	set := make(map[string]struct{}, len(g))
	for from, edges := range g {
		set[from] = struct{}{}
		for to := range edges {
			set[to] = struct{}{}
		}
	}
	nodes := make([]string, 0, len(set))
	for n := range set {
		nodes = append(nodes, n)
	}
	sort.Strings(nodes)
	return nodes
}

// HasNode indica si el nodo existe como origen o destino de alguna arista.
func (g Graph) HasNode(node string) bool {
	if _, ok := g[node]; ok {
		return true
	}
	for _, edges := range g {
		if _, ok := edges[node]; ok {
			return true
		}
	}
	return false
}

// Validate comprueba precondiciones de Dijkstra: pesos finitos y no negativos,
// nombres no vacíos y sin auto-aristas.
func (g Graph) Validate() error {
	if len(g) == 0 {
		return ErrEmptyGraph
	}
	for from, edges := range g {
		if from == "" {
			return fmt.Errorf("%w: nodo con nombre vacío", ErrInvalidGraph)
		}
		for to, w := range edges {
			switch {
			case to == "":
				return fmt.Errorf("%w: arista desde %q hacia un nodo vacío", ErrInvalidGraph, from)
			case math.IsNaN(w) || math.IsInf(w, 0):
				return fmt.Errorf("%w: peso no finito en %q -> %q", ErrInvalidGraph, from, to)
			case w < 0:
				return fmt.Errorf("%w: peso negativo %v en %q -> %q (Dijkstra requiere pesos >= 0)", ErrInvalidGraph, w, from, to)
			case to == from:
				return fmt.Errorf("%w: auto-arista en %q", ErrInvalidGraph, from)
			}
		}
	}
	return nil
}
