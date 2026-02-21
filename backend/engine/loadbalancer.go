package engine

import "math"

// LoadBalancer distributes incoming traffic across downstream nodes using Round Robin.
// DOWN nodes are excluded from routing, causing traffic redistribution.
type LoadBalancer struct {
	BaseNode
	throughput            float64
	readTP                float64
	writeTP               float64
	utilization           float64
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
		lb.ResetIncoming()
		return
	}

	inRead := lb.IncomingRead
	inWrite := lb.IncomingWrite
	inTotal := lb.Incoming + inRead + inWrite
	lb.ResetIncoming()

	// Proportional split if generic traffic exists
	if lb.Incoming > 0 && inRead == 0 && inWrite == 0 {
		inRead = inTotal * 0.7
		inWrite = inTotal * 0.3
	}

	// Initial cap: Load Balancer self-capacity
	processed := math.Min(inTotal, lb.CapacityRPS)
	// Force integer throughput for UI consistency
	lb.throughput = math.Floor(processed + 0.5)

	// Proportional split for throughput metrics (derived from integer total)
	if inTotal > 0 {
		ratio := lb.throughput / inTotal
		lb.readTP = inRead * ratio
		lb.writeTP = inWrite * ratio
	}

	downstream := lb.Downstream()
	if len(downstream) == 0 || processed == 0.0 {
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
		lb.currentDropped = inTotal
		lb.totalDropped += inTotal
		return
	}

	// Distribution with Primary/Replica awareness and Capacity-Weighting
	if processed > 0 {
		var primaries []Node
		dedupMap := make(map[string]bool)

		var uniqueAlive []Node
		for _, n := range alive {
			if !dedupMap[n.ID()] {
				dedupMap[n.ID()] = true
				uniqueAlive = append(uniqueAlive, n)

				if db, ok := n.(*Database); ok {
					if !db.IsReplica {
						primaries = append(primaries, n)
					}
				} else {
					primaries = append(primaries, n)
				}
			}
		}

		distribute := func(total float64, targets []Node, isWrite bool) {
			if len(targets) == 0 {
				return
			}

			totalInt := int(math.Floor(total + 0.5))
			if totalInt == 0 {
				return
			}

			// Calculate weights by capacity
			var totalCap float64
			for _, n := range targets {
				totalCap += math.Max(1.0, n.MaxRPS())
			}

			remaining := totalInt
			for i, n := range targets {
				var val int
				if i == len(targets)-1 {
					val = remaining
				} else {
					share := (math.Max(1.0, n.MaxRPS()) / totalCap) * float64(totalInt)
					val = int(math.Floor(share + 0.5))
					if val > remaining {
						val = remaining
					}
				}

				if isWrite {
					n.AddIncomingWrite(float64(val))
				} else {
					n.AddIncomingRead(float64(val))
				}
				remaining -= val
			}
		}

		// Forward WRITEs to Primaries only
		writeTargets := primaries
		if len(writeTargets) == 0 {
			writeTargets = uniqueAlive
		}
		distribute(lb.writeTP, writeTargets, true)

		// Forward READs to ALL healthy (unique) nodes
		distribute(lb.readTP, uniqueAlive, false)
	}

	if lb.CapacityRPS > 0 {
		lb.utilization = math.Min(inTotal/lb.CapacityRPS, 1.0)
	}
}

func (lb *LoadBalancer) MaxRPS() float64 {
	return lb.CapacityRPS
}

func (lb *LoadBalancer) CurrentLatency() float64 {
	downstream := lb.Downstream()
	var alive []Node
	for _, node := range downstream {
		if !node.IsDown() {
			alive = append(alive, node)
		}
	}
	if len(alive) == 0 {
		return 0
	}
	sum := 0.0
	for _, node := range alive {
		sum += node.CurrentLatency()
	}
	return (sum / float64(len(alive))) + 0.5 // + neglible routing overhead
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
	lat := lb.CurrentLatency()
	return NodeMetrics{
		ID:              lb.NodeID,
		Type:            lb.NodeType,
		Label:           lb.NodeLabel,
		Utilization:     util,
		Latency:         lat,
		QueueDepth:      0,
		ReadThroughput:  lb.readTP,
		WriteThroughput: lb.writeTP,
		Throughput:      lb.throughput,
		Dropped:         lb.totalDropped,
		DropRate:        lb.currentDropped,
		Status:          status,
		ArrivalRead:     lb.lastArrivalR,
		ArrivalWrite:    lb.lastArrivalW,
		ArrivalTotal:    lb.lastArrivalT,
	}
}
func (lb *LoadBalancer) ResetQueues() {
	lb.throughput = 0
	lb.currentDropped = 0
}
