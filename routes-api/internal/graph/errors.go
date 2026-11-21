package graph

import "errors"

// Errores de dominio. La capa HTTP los traduce a status codes con errors.Is.
var (
	ErrEmptyGraph   = errors.New("el grafo está vacío")
	ErrInvalidGraph = errors.New("grafo inválido")
	ErrNoSources    = errors.New("se requiere al menos una base de grúas")
	ErrUnknownNode  = errors.New("nodo inexistente en el grafo")
	ErrUnreachable  = errors.New("la ubicación no es alcanzable desde ninguna base")
)
