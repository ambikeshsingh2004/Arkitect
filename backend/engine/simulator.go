package engine

import (
	"context"
	"math"
	"sync"
	"time"
)

// TickResult is the per-tick output sent to the frontend via WebSocket.
type TickResult struct {
	Tick        int           `json:"tick"`
	Timestamp   int64         `json:"timestamp"`
	Nodes       []NodeMetrics `json:"nodes"`
	Bottlenecks []string      `json:"bottleneckIds"`
	TotalRPS    float64       `json:"totalRPS"`
}

// Simulator runs the tick-based simulation loop.
type Simulator struct {
	graph      *Graph
	mu         sync.RWMutex
	tickCount  int
	spikeOn    bool
	trafficRPS float64
	output     chan TickResult
	cancel     context.CancelFunc
	done       chan struct{}

	// for bottleneck detection
	prevQueueDepth map[string]float64
}

// NewSimulator creates a new simulator from a graph.
func NewSimulator(graph *Graph) *Simulator {
	return &Simulator{
		graph:          graph,
		trafficRPS:     graph.TrafficRPS,
		output:         make(chan TickResult, 100),
		done:           make(chan struct{}),
		prevQueueDepth: make(map[string]float64),
	}
}

// Output returns the channel to read tick results from.
func (s *Simulator) Output() <-chan TickResult {
	return s.output
}

// SetTrafficRPS updates the traffic injection rate.
func (s *Simulator) SetTrafficRPS(rps float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.trafficRPS = rps
}

// SetSpike toggles spike traffic mode (2x multiplier).
func (s *Simulator) SetSpike(on bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.spikeOn = on
}

// SetNodeDown marks a node as UP or DOWN by ID.
// DOWN nodes are skipped during processing and excluded from LB routing.
func (s *Simulator) SetNodeDown(nodeID string, down bool) bool {
	node, ok := s.graph.Nodes[nodeID]
	if !ok {
		return false
	}
	node.SetDown(down)
	return true
}

// UpdateNodeConfig updates a node's configuration live during simulation.
// Supports maxRPS and baseLatency for AppServer and Database nodes.
func (s *Simulator) UpdateNodeConfig(nodeID string, maxRPS, baseLatency float64) bool {
	node, ok := s.graph.Nodes[nodeID]
	if !ok {
		return false
	}

	switch n := node.(type) {
	case *AppServer:
		if maxRPS > 0 {
			n.MaxRPS = maxRPS
		}
		if baseLatency > 0 {
			n.BaseLatency = baseLatency
		}
	case *Database:
		if maxRPS > 0 {
			n.MaxRPS = maxRPS
		}
		if baseLatency > 0 {
			n.BaseLatency = baseLatency
		}
	default:
		return false
	}
	return true
}

// Start begins the simulation loop.
func (s *Simulator) Start() {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	go s.run(ctx)
}

// Stop halts the simulation loop.
func (s *Simulator) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	<-s.done
	close(s.output)
}

// run is the main simulation loop.
func (s *Simulator) run(ctx context.Context) {
	defer close(s.done)

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

// tick executes a single simulation step.
func (s *Simulator) tick() {
	s.mu.RLock()
	trafficRPS := s.trafficRPS
	spike := s.spikeOn
	s.mu.RUnlock()

	if spike {
		trafficRPS *= 2.0
	}

	s.tickCount++

	// 1. Inject traffic at entry node
	s.graph.EntryNode.AddIncoming(trafficRPS)

	// 2. Process in topological order (each node captures & resets its own incoming)
	for _, node := range s.graph.Sorted {
		node.Process()
	}

	// 4. Collect metrics and detect bottlenecks (all nodes above threshold)
	metrics := make([]NodeMetrics, 0, len(s.graph.Sorted))
	var bottleneckIDs []string
	const bottleneckThreshold = 0.7

	for _, node := range s.graph.Sorted {
		m := node.GetMetrics()
		metrics = append(metrics, m)

		// Bottleneck scoring: utilization + 0.3 * queue growth rate
		queueGrowth := 0.0
		if prev, ok := s.prevQueueDepth[m.ID]; ok {
			queueGrowth = m.QueueDepth - prev
		}
		score := m.Utilization + 0.3*math.Max(0, queueGrowth/math.Max(1, m.Throughput))

		if score > bottleneckThreshold && m.Type != "loadbalancer" && m.Type != "client" {
			bottleneckIDs = append(bottleneckIDs, m.ID)
		}

		s.prevQueueDepth[m.ID] = m.QueueDepth
	}

	result := TickResult{
		Tick:        s.tickCount,
		Timestamp:   time.Now().UnixMilli(),
		Nodes:       metrics,
		Bottlenecks: bottleneckIDs,
		TotalRPS:    trafficRPS,
	}

	// Non-blocking send
	select {
	case s.output <- result:
	default:
		// Channel full, skip this tick (consumer is slow)
	}
}
