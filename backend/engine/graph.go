package engine

import (
	"encoding/json"
	"fmt"
)

// ---- JSON input structures ----

// NodeConfig represents a node definition from the frontend.
type NodeConfig struct {
	ID                    string  `json:"id"`
	Type                  string  `json:"type"`
	Label                 string  `json:"label"`
	MaxRPS                float64 `json:"maxRPS,omitempty"`
	BaseLatency           float64 `json:"baseLatency,omitempty"`
	IsReplica             bool    `json:"isReplica,omitempty"`
	BackpressureEnabled   bool    `json:"backpressureEnabled,omitempty"`
	BackpressureThreshold float64 `json:"backpressureThreshold,omitempty"`
	Algorithm             string  `json:"algorithm,omitempty"`
	ReadRatio             float64 `json:"readRatio,omitempty"`
}

// EdgeConfig represents an edge (connection) from the frontend.
type EdgeConfig struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

// ArchitectureConfig is the full topology sent by the frontend.
type ArchitectureConfig struct {
	Nodes      []NodeConfig `json:"nodes"`
	Edges      []EdgeConfig `json:"edges"`
	TrafficRPS float64      `json:"trafficRPS"`
}

// Graph holds the constructed simulation graph.
type Graph struct {
	Nodes      map[string]Node
	EntryNode  Node   // traffic injection point (should be a load balancer)
	Sorted     []Node // topological order
	TrafficRPS float64
}

// BuildGraph constructs a simulation graph from the architecture JSON.
func BuildGraph(configJSON []byte) (*Graph, error) {
	var config ArchitectureConfig
	if err := json.Unmarshal(configJSON, &config); err != nil {
		return nil, fmt.Errorf("invalid architecture JSON: %w", err)
	}

	return BuildGraphFromConfig(&config)
}

// BuildGraphFromConfig constructs a simulation graph from a parsed config.
func BuildGraphFromConfig(config *ArchitectureConfig) (*Graph, error) {
	if len(config.Nodes) == 0 {
		return nil, fmt.Errorf("architecture must have at least one node")
	}

	nodes := make(map[string]Node)

	// Create all nodes
	for _, nc := range config.Nodes {
		var node Node
		switch nc.Type {
		case "client":
			node = NewClient(nc.ID, nc.Label)
		case "loadbalancer":
			maxRPS := nc.MaxRPS
			if maxRPS == 0 {
				maxRPS = 500 // default
			}
			lb := NewLoadBalancer(nc.ID, nc.Label)
			lb.CapacityRPS = maxRPS
			lb.BackpressureEnabled = nc.BackpressureEnabled
			if nc.BackpressureThreshold > 0 {
				lb.BackpressureThreshold = nc.BackpressureThreshold
			}
			if nc.Algorithm != "" {
				lb.Algorithm = nc.Algorithm
			}
			node = lb
		case "appserver":
			maxRPS := nc.MaxRPS
			if maxRPS == 0 {
				maxRPS = 100 // default
			}
			baseLatency := nc.BaseLatency
			if baseLatency == 0 {
				baseLatency = 20 // default 20ms
			}
			node = NewAppServer(nc.ID, nc.Label, maxRPS, baseLatency)
		case "database":
			maxRPS := nc.MaxRPS
			if maxRPS == 0 {
				maxRPS = 50 // default
			}
			baseLatency := nc.BaseLatency
			if baseLatency == 0 {
				baseLatency = 50 // default 50ms
			}
			db := NewDatabase(nc.ID, nc.Label, maxRPS, baseLatency)
			db.IsReplica = nc.IsReplica
			node = db
		case "dbrouter":
			r := NewDBRouter(nc.ID, nc.Label)
			if nc.ReadRatio > 0 {
				r.ReadRatio = nc.ReadRatio
			}
			node = r
		default:
			return nil, fmt.Errorf("unknown node type: %s", nc.Type)
		}
		nodes[nc.ID] = node
	}

	// Build adjacency (downstream connections)
	downstreamMap := make(map[string][]Node)
	inDegree := make(map[string]int)

	for id := range nodes {
		inDegree[id] = 0
	}

	for _, edge := range config.Edges {
		src, ok := nodes[edge.Source]
		if !ok {
			return nil, fmt.Errorf("edge source node not found: %s", edge.Source)
		}
		tgt, ok := nodes[edge.Target]
		if !ok {
			return nil, fmt.Errorf("edge target node not found: %s", edge.Target)
		}
		_ = src
		downstreamMap[edge.Source] = append(downstreamMap[edge.Source], tgt)
		inDegree[edge.Target]++
	}

	// Wire downstream
	for id, node := range nodes {
		if ds, ok := downstreamMap[id]; ok {
			node.SetDownstream(ds)
		}
	}

	// Find entry nodes (in-degree 0)
	var entryNodes []Node
	for id, deg := range inDegree {
		if deg == 0 {
			entryNodes = append(entryNodes, nodes[id])
		}
	}

	if len(entryNodes) == 0 {
		return nil, fmt.Errorf("no entry node found (all nodes have incoming edges — cycle?)")
	}

	// Topological sort (Kahn's algorithm)
	sorted, err := topoSort(nodes, config.Edges)
	if err != nil {
		return nil, err
	}

	trafficRPS := config.TrafficRPS
	if trafficRPS == 0 {
		trafficRPS = 100
	}

	return &Graph{
		Nodes:      nodes,
		EntryNode:  entryNodes[0], // primary entry
		Sorted:     sorted,
		TrafficRPS: trafficRPS,
	}, nil
}

// topoSort performs topological sort using Kahn's algorithm.
func topoSort(nodes map[string]Node, edges []EdgeConfig) ([]Node, error) {
	inDeg := make(map[string]int)
	adj := make(map[string][]string)

	for id := range nodes {
		inDeg[id] = 0
	}
	for _, e := range edges {
		adj[e.Source] = append(adj[e.Source], e.Target)
		inDeg[e.Target]++
	}

	var queue []string
	for id, d := range inDeg {
		if d == 0 {
			queue = append(queue, id)
		}
	}

	var sorted []Node
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		sorted = append(sorted, nodes[curr])

		for _, next := range adj[curr] {
			inDeg[next]--
			if inDeg[next] == 0 {
				queue = append(queue, next)
			}
		}
	}

	if len(sorted) != len(nodes) {
		return nil, fmt.Errorf("graph has a cycle — topological sort failed")
	}

	return sorted, nil
}
