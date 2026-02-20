package engine

import "math"

// AppServer models an application server with capacity constraints and queue buildup.
// When incoming + queued exceeds MaxRPS, only MaxRPS requests are processed per tick.
// Excess accumulates in the queue, causing latency amplification.
type AppServer struct {
	BaseNode
	MaxRPS      float64
	BaseLatency float64 // ms

	queueDepth  float64
	throughput  float64
	dropped     float64
	latency     float64
	utilization float64
}

// NewAppServer creates a new AppServer node.
func NewAppServer(id, label string, maxRPS, baseLatency float64) *AppServer {
	return &AppServer{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "appserver",
			NodeLabel: label,
		},
		MaxRPS:      maxRPS,
		BaseLatency: baseLatency,
	}
}

// Process handles incoming traffic with capacity constraints.
// If this node is DOWN, it is skipped entirely — no traffic is processed or forwarded.
func (s *AppServer) Process() {
	if s.Down {
		s.throughput = 0
		s.latency = 0
		s.utilization = 0
		// Queue persists but doesn't grow
		return
	}

	totalArrival := s.Incoming + s.queueDepth

	// How much we can actually process this tick
	processed := math.Min(totalArrival, s.MaxRPS)
	s.throughput = processed

	// Remaining goes back into queue
	s.queueDepth = math.Max(0, totalArrival-s.MaxRPS)

	// Drop if queue exceeds 5x capacity (prevent infinite buildup)
	maxQueue := s.MaxRPS * 5
	if s.queueDepth > maxQueue {
		s.dropped = s.queueDepth - maxQueue
		s.queueDepth = maxQueue
	} else {
		s.dropped = 0
	}

	// Utilization = totalLoad / capacity (spec: uses total load including queue)
	if s.MaxRPS > 0 {
		s.utilization = math.Min(totalArrival, s.MaxRPS*2) / s.MaxRPS
		if s.utilization > 1.0 {
			s.utilization = 1.0
		}
	}

	// Latency = baseLatency + (queue/capacity * scalingFactor)
	s.latency = s.BaseLatency
	if s.MaxRPS > 0 {
		s.latency += (s.queueDepth / s.MaxRPS) * 1000 // queue delay in ms
	}

	// Forward processed traffic downstream (cascading overload)
	downstream := s.Downstream()
	n := len(downstream)
	if n > 0 && processed > 0 {
		perNode := processed / float64(n)
		for _, node := range downstream {
			node.AddIncoming(perNode)
		}
	}
}

// GetMetrics returns the current metrics for this app server.
func (s *AppServer) GetMetrics() NodeMetrics {
	return NodeMetrics{
		ID:          s.NodeID,
		Type:        s.NodeType,
		Label:       s.NodeLabel,
		Utilization: s.utilization,
		Latency:     s.latency,
		QueueDepth:  s.queueDepth,
		Throughput:  s.throughput,
		Dropped:     s.dropped,
		Status:      StatusFromUtilization(s.utilization, s.queueDepth, s.Down),
	}
}
