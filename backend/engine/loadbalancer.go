package engine

// LoadBalancer distributes incoming traffic across downstream nodes using Round Robin.
// DOWN nodes are excluded from routing, causing traffic redistribution.
type LoadBalancer struct {
	BaseNode
	throughput            float64
	CapacityRPS           float64
	BackpressureEnabled   bool
	BackpressureThreshold float64
	Algorithm             string // "round-robin", "weighted", "least-connections"
	rrIndex               int    // index for round-robin distribution
	currentDropped        float64
	totalDropped          float64
}

// NewLoadBalancer creates a new LoadBalancer node.
func NewLoadBalancer(id, label string) *LoadBalancer {
	return &LoadBalancer{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "loadbalancer",
			NodeLabel: label,
		},
		CapacityRPS:           500,
		BackpressureThreshold: 0.9,
		Algorithm:             "round-robin",
	}
}

// Process distributes all incoming RPS across healthy downstream nodes.
// DOWN nodes are skipped — their traffic is redistributed to remaining UP nodes.
func (lb *LoadBalancer) Process() {
	if lb.Down {
		lb.throughput = 0
		lb.Incoming = 0 // consume incoming
		return
	}

	incoming := lb.Incoming
	lb.Incoming = 0
	lb.currentDropped = 0 // Reset per tick

	// Initial cap: Load Balancer self-capacity
	effectiveIncoming := incoming
	if lb.CapacityRPS > 0 && incoming > lb.CapacityRPS {
		effectiveIncoming = lb.CapacityRPS
	}

	lb.throughput = effectiveIncoming
	downstream := lb.Downstream()
	if len(downstream) == 0 || effectiveIncoming == 0.0 {
		return
	}

	// Filter to only UP nodes
	var alive []Node
	for _, node := range downstream {
		if !node.IsDown() {
			alive = append(alive, node)
		}
	}

	if len(alive) == 0 {
		lb.currentDropped = incoming
		lb.totalDropped += incoming
		return
	}

	// Calculate pool capacity for backpressure
	totalPoolCapacity := 0.0
	for _, node := range alive {
		totalPoolCapacity += node.MaxRPS()
	}

	// Final cap: Backpressure (XY% pool capacity shield)
	if lb.BackpressureEnabled && totalPoolCapacity > 0 {
		threshold := lb.BackpressureThreshold
		if threshold <= 0 {
			threshold = 0.9 // default fallback
		}
		poolCap := totalPoolCapacity * threshold
		if effectiveIncoming > poolCap {
			effectiveIncoming = poolCap
		}
	}

	// Calculate total drops (Self-Cap drop + Backpressure drop)
	dropped := incoming - effectiveIncoming
	if dropped > 0 {
		lb.currentDropped = dropped
		lb.totalDropped += dropped
	}

	if effectiveIncoming <= 0 {
		return
	}

	// 3. Distribution based on Algorithm
	switch lb.Algorithm {
	case "weighted":
		if totalPoolCapacity > 0 {
			for _, node := range alive {
				share := effectiveIncoming * (node.MaxRPS() / totalPoolCapacity)
				node.AddIncoming(share)
			}
		} else {
			perNode := effectiveIncoming / float64(len(alive))
			for _, node := range alive {
				node.AddIncoming(perNode)
			}
		}

	case "round-robin":
		if lb.rrIndex >= len(alive) {
			lb.rrIndex = 0
		}
		alive[lb.rrIndex].AddIncoming(effectiveIncoming)
		lb.rrIndex = (lb.rrIndex + 1) % len(alive)

	default: // Default to Weighted (User's specific request for capacity-based)
		if totalPoolCapacity > 0 {
			for _, node := range alive {
				share := effectiveIncoming * (node.MaxRPS() / totalPoolCapacity)
				node.AddIncoming(share)
			}
		} else {
			perNode := effectiveIncoming / float64(len(alive))
			for _, node := range alive {
				node.AddIncoming(perNode)
			}
		}
	}
}

func (lb *LoadBalancer) MaxRPS() float64 {
	return lb.CapacityRPS
}

// GetMetrics returns the current metrics for this load balancer.
func (lb *LoadBalancer) GetMetrics() NodeMetrics {
	util := 0.0
	if lb.CapacityRPS > 0 {
		util = lb.throughput / lb.CapacityRPS
	}
	status := StatusFromUtilization(util, 0, lb.Down)
	if lb.currentDropped > 0 {
		status = "rejecting"
	}
	return NodeMetrics{
		ID:          lb.NodeID,
		Type:        lb.NodeType,
		Label:       lb.NodeLabel,
		Utilization: util,
		Latency:     0.5, // negligible routing latency
		QueueDepth:  0,
		Throughput:  lb.throughput,
		Dropped:     lb.totalDropped,
		DropRate:    lb.currentDropped,
		Status:      status,
	}
}
