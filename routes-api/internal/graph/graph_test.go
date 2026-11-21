package graph

import (
	"reflect"
	"testing"
)

func TestNodesIncludesDestinationOnlyNodes(t *testing.T) {
	g := Graph{"B": {"C": 1}, "A": {"B": 2}}
	if got := g.Nodes(); !reflect.DeepEqual(got, []string{"A", "B", "C"}) {
		t.Fatalf("got %v", got)
	}
}

func TestHasNode(t *testing.T) {
	g := Graph{"A": {"B": 1}}
	for node, want := range map[string]bool{"A": true, "B": true, "Z": false} {
		if got := g.HasNode(node); got != want {
			t.Errorf("HasNode(%q) = %v, want %v", node, got, want)
		}
	}
}

func TestValidateAcceptsValidGraph(t *testing.T) {
	if err := pdfGraph().Validate(); err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
}
