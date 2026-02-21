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
	readTP           float64
	writeTP          float64
	dropped          float64 // drops THIS tick
	totalDropped     float64 // accumulated drops since start
	utilization      float64
	ConcurrencyLimit float64
	effectiveLim     float64
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
		s.ResetIncoming()
		return
	}

	inRead := s.IncomingRead
	inWrite := s.IncomingWrite
	inTotal := s.Incoming + inRead + inWrite
	s.ResetIncoming()

	// Proportional split if generic traffic exists
	if inTotal > 0 && inRead == 0 && inWrite == 0 {
		inRead = inTotal * 0.7
		inWrite = inTotal * 0.3
	}

	totalLatency := s.CurrentLatency()
	effectiveCapacity := s.CapacityRPS

	if s.ConcurrencyLimit > 0 && totalLatency > 0 {
		// Note: Logic kept for schema compatibility, but we effectively disable it
		// by ensuring the throttled capacity is never lower than the configured RPS
		// unless the user specifically wants to model this (which they've rejected).
		// For now, we set effectiveLim to 0 to signal "Unlimited" visually.
		s.effectiveLim = 0
	} else {
		s.effectiveLim = 0
	}

	totalArrival := inTotal + s.queueDepth
	processed := math.Min(totalArrival, effectiveCapacity)
	s.throughput = processed

	// Proportional split for throughput metrics (using integers for downstream consistency)
	if totalArrival > 0 {
		ratio := processed / totalArrival
		s.readTP = (inRead + (s.queueDepth * (inRead / math.Max(1, inTotal)))) * ratio
		s.writeTP = (inWrite + (s.queueDepth * (inWrite / math.Max(1, inTotal)))) * ratio
	}

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
		s.utilization = math.Min(inTotal/s.CapacityRPS, 1.0)
		if s.queueDepth > 0 || processed < totalArrival-0.1 {
			// Force 100% util if queue exists OR if we are throttled by capacity
			s.utilization = 1.0
		}
	}

	// Forward to healthy nodes only
	downstream := s.Downstream()
	var healthy []Node
	for _, node := range downstream {
		if !node.IsDown() {
			healthy = append(healthy, node)
		}
	}

	if len(healthy) > 0 && processed > 0.0 {
		var primaries []Node
		for _, n := range healthy {
			if db, ok := n.(*Database); ok {
				if !db.IsReplica {
					primaries = append(primaries, n)
				}
			} else {
				primaries = append(primaries, n)
			}
		}

		// Forward WRITEs to Primaries only (Discrete distribution)
		if s.writeTP > 0 {
			targets := primaries
			if len(targets) == 0 {
				targets = healthy
			}
			totalWrites := int(math.Floor(s.writeTP + 0.5))
			base := totalWrites / len(targets)
			remainder := totalWrites % len(targets)

			for i, node := range targets {
				val := float64(base)
				if i < remainder {
					val += 1.0
				}
				node.AddIncomingWrite(val)
			}
		}

		// Forward READs to ALL healthy nodes (Discrete distribution)
		if s.readTP > 0 {
			totalReads := int(math.Floor(s.readTP + 0.5))
			base := totalReads / len(healthy)
			remainder := totalReads % len(healthy)

			for i, node := range healthy {
				val := float64(base)
				if i < remainder {
					val += 1.0
				}
				node.AddIncomingRead(val)
			}
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
		ID:                s.NodeID,
		Type:              s.NodeType,
		Label:             s.NodeLabel,
		Utilization:       s.utilization,
		Latency:           lat,
		QueueDepth:        s.queueDepth,
		ReadThroughput:    s.readTP,
		WriteThroughput:   s.writeTP,
		Throughput:        s.throughput,
		Dropped:           s.totalDropped,
		DropRate:          s.dropped,
		Status:            StatusFromUtilization(s.utilization, s.queueDepth, s.Down),
		ArrivalRead:       s.lastArrivalR,
		ArrivalWrite:      s.lastArrivalW,
		ArrivalTotal:      s.lastArrivalT,
		EffectiveCapacity: s.effectiveLim,
	}
}

func (s *AppServer) MaxRPS() float64 {
	return s.CapacityRPS
}

func (s *AppServer) ResetQueues() {
	s.queueDepth = 0
	s.throughput = 0
}
