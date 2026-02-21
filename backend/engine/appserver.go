package engine

import "math"

// AppServer models an application server with capacity constraints and queue buildup.
// When incoming + queued exceeds MaxRPS, only MaxRPS requests are processed per tick.
// Excess accumulates in the queue, causing latency amplification.
type AppServer struct {
	BaseNode
	CapacityRPS float64
	BaseLatency float64 // ms

	queueDepth   float64
	throughput   float64
	dropped      float64 // drops THIS tick
	totalDropped float64 // accumulated drops since start
	latency      float64
	utilization  float64
}

// NewAppServer creates a new AppServer node.
func NewAppServer(id, label string, maxRPS, baseLatency float64) *AppServer {
	return &AppServer{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "appserver",
			NodeLabel: label,
		},
		CapacityRPS: maxRPS,
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
		s.dropped = 0
		s.Incoming = 0 // consume incoming
		return
	}

	incoming := s.Incoming
	s.Incoming = 0 // reset incoming immediately after capturing

	totalArrival := incoming + s.queueDepth

	// How much we can actually process this tick
	processed := math.Min(totalArrival, s.CapacityRPS)
	s.throughput = processed

	// Remaining goes back into queue
	s.queueDepth = math.Max(0.0, totalArrival-processed)

	// Drop if queue exceeds 5x capacity (prevent infinite buildup)
	maxQueue := s.CapacityRPS * 5.0
	if s.queueDepth > maxQueue {
		s.dropped = s.queueDepth - maxQueue
		s.totalDropped += s.dropped // accumulate
		s.queueDepth = maxQueue
	} else {
		s.dropped = 0
	}

	// Utilization = incoming / capacity (how much of capacity is demanded)
	if s.CapacityRPS > 0.0 {
		s.utilization = math.Min(incoming/s.CapacityRPS, 1.0)
	}

	// Latency = baseLatency + queue wait time (seconds → ms)
	s.latency = s.BaseLatency
	if s.CapacityRPS > 0.0 {
		s.latency += (s.queueDepth / s.CapacityRPS) * 1000.0
	}

	// Forward processed traffic downstream (cascading overload)
	downstream := s.Downstream()
	n := float64(len(downstream))
	if n > 0.0 && processed > 0.0 {
		perNode := processed / n
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
		Dropped:     s.totalDropped,
		DropRate:    s.dropped,
		Status:      StatusFromUtilization(s.utilization, s.queueDepth, s.Down),
	}
}

func (s *AppServer) MaxRPS() float64 {
	return s.CapacityRPS
}
