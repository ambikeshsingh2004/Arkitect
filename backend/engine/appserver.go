package engine

import "math"

// AppServer models an application server with capacity constraints and queue buildup.
// When incoming + queued exceeds MaxRPS, only MaxRPS requests are processed per tick.
// Excess accumulates in the queue, causing latency amplification.
type AppServer struct {
	BaseNode
	CapacityRPS float64
	BaseLatency float64 // ms

	queueDepth       float64
	throughput       float64
	dropped          float64 // drops THIS tick
	totalDropped     float64 // accumulated drops since start
	utilization      float64
	ConcurrencyLimit float64
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
		s.utilization = 0
		s.dropped = 0
		s.Incoming = 0
		return
	}

	// 1. Calculate downstream latency
	downstreamLatency := 0.0
	downstream := s.Downstream()
	if len(downstream) > 0 {
		sum := 0.0
		for _, node := range downstream {
			sum += node.CurrentLatency()
		}
		downstreamLatency = sum / float64(len(downstream))
	}

	// 2. Total Latency = Base + Downstream + Queuing delay
	queueDelay := 0.0
	if s.CapacityRPS > 0 {
		queueDelay = (s.queueDepth / s.CapacityRPS) * 1000.0
	}
	totalLatency := s.BaseLatency + downstreamLatency + queueDelay

	// 3. Little's Law: Effective Capacity = (Concurrency / Latency) * 1000
	effectiveCapacity := s.CapacityRPS
	if s.ConcurrencyLimit > 0 && totalLatency > 0 {
		eff := (s.ConcurrencyLimit / totalLatency) * 1000.0
		if eff < effectiveCapacity {
			effectiveCapacity = eff
		}
	}

	incoming := s.Incoming
	s.Incoming = 0

	totalArrival := incoming + s.queueDepth

	// 4. Process traffic capped by both RPS and Effective Concurrency Capacity
	processed := math.Min(totalArrival, effectiveCapacity)
	s.throughput = processed

	s.queueDepth = math.Max(0.0, totalArrival-processed)

	maxQueue := s.CapacityRPS * 5.0
	if s.queueDepth > maxQueue {
		s.dropped = s.queueDepth - maxQueue
		s.totalDropped += s.dropped
		s.queueDepth = maxQueue
	} else {
		s.dropped = 0
	}

	if s.CapacityRPS > 0.0 {
		s.utilization = math.Min(incoming/s.CapacityRPS, 1.0)
	}

	// Forward to healthy nodes only
	var healthy []Node
	for _, node := range downstream {
		if !node.IsDown() {
			healthy = append(healthy, node)
		}
	}

	if len(healthy) > 0 && processed > 0.0 {
		perNode := processed / float64(len(healthy))
		for _, node := range healthy {
			node.AddIncoming(perNode)
		}
	}
}

func (s *AppServer) CurrentLatency() float64 {
	downstreamLatency := 0.0
	downstream := s.Downstream()
	if len(downstream) > 0 {
		sum := 0.0
		for _, node := range downstream {
			sum += node.CurrentLatency()
		}
		downstreamLatency = sum / float64(len(downstream))
	}
	queueDelay := 0.0
	if s.CapacityRPS > 0 {
		queueDelay = (s.queueDepth / s.CapacityRPS) * 1000.0
	}
	return s.BaseLatency + downstreamLatency + queueDelay
}

func (s *AppServer) GetMetrics() NodeMetrics {
	lat := s.CurrentLatency()
	return NodeMetrics{
		ID:          s.NodeID,
		Type:        s.NodeType,
		Label:       s.NodeLabel,
		Utilization: s.utilization,
		Latency:     lat,
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
