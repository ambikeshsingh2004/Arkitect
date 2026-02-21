package engine

import "math"

// DBRouter splits traffic into reads (70%) and writes (30%)
// Writes go to primary (IsReplica: false)
// Reads go to replicas (IsReplica: true)
type DBRouter struct {
	BaseNode
	throughput float64
	readTP     float64
	writeTP    float64
	ReadRatio  float64 // 0.0 to 1.0 (portion of traffic that is reads)
}

// NewDBRouter creates a new DBRouter node.
func NewDBRouter(id, label string) *DBRouter {
	return &DBRouter{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "dbrouter",
			NodeLabel: label,
		},
		ReadRatio: 0.7, // default 70% reads
	}
}

// Process splits incoming RPS based on ReadRatio.
func (r *DBRouter) Process() {
	if r.Down {
		r.throughput = 0
		r.ResetIncoming()
		return
	}

	inRead := r.IncomingRead
	inWrite := r.IncomingWrite
	incomingTotal := r.Incoming + inRead + inWrite

	// Fallback split if needed
	if incomingTotal > 0 && inRead == 0 && inWrite == 0 {
		inRead = incomingTotal * r.ReadRatio
		inWrite = incomingTotal * (1.0 - r.ReadRatio)
	}

	r.ResetIncoming()
	r.readTP = inRead
	r.writeTP = inWrite
	r.throughput = incomingTotal

	downstream := r.Downstream()
	if len(downstream) == 0 {
		return
	}

	var primaries []Node
	var allNodes []Node

	for _, n := range downstream {
		if !n.IsDown() {
			allNodes = append(allNodes, n)
			if db, ok := n.(*Database); ok {
				if !db.IsReplica {
					primaries = append(primaries, n)
				}
			} else {
				// if not a DB, treat as primary for fallback
				primaries = append(primaries, n)
			}
		}
	}

	// Forward all WRITEs to Primaries
	if inWrite > 0 && len(primaries) > 0 {
		perPrimary := inWrite / float64(len(primaries))
		for _, p := range primaries {
			p.AddIncomingWrite(perPrimary)
		}
	} else if inWrite > 0 && len(allNodes) > 0 {
		// Extreme fallback: if no primary, send to anyone so it doesn't just disappear?
		// Or drop? Let's drop writes if no primary exists.
	}

	// Forward all READs (Replica-First Adaptive Balancing)
	if inRead > 0 && len(allNodes) > 0 {
		var replicas []Node
		for _, n := range allNodes {
			if db, ok := n.(*Database); ok && db.IsReplica {
				replicas = append(replicas, n)
			}
		}

		targets := allNodes
		// If healthy replicas exist, send ALL reads there to protect Primary's write capacity
		if len(replicas) > 0 {
			targets = replicas
		}

		totalReads := int(math.Floor(inRead + 0.5))
		base := totalReads / len(targets)
		remainder := totalReads % len(targets)

		for i, node := range targets {
			val := float64(base)
			if i < remainder {
				val += 1.0
			}
			node.AddIncomingRead(val)
		}
	}
}

// GetMetrics returns metrics for the DB Router.
func (r *DBRouter) GetMetrics() NodeMetrics {
	util := 0.0
	if r.throughput > 0.0 {
		util = 0.1
	}
	return NodeMetrics{
		ID:              r.NodeID,
		Type:            r.NodeType,
		Label:           r.NodeLabel,
		Utilization:     util,
		Latency:         1.0, // slight routing overhead
		ReadThroughput:  r.readTP,
		WriteThroughput: r.writeTP,
		Throughput:      r.throughput,
		Status:          StatusFromUtilization(util, 0, r.Down),
		ArrivalRead:     r.lastArrivalR,
		ArrivalWrite:    r.lastArrivalW,
		ArrivalTotal:    r.lastArrivalT,
	}
}

func (r *DBRouter) MaxRPS() float64 {
	return 0
}
func (r *DBRouter) CurrentLatency() float64 {
	downstream := r.Downstream()
	if len(downstream) == 0 {
		return 0
	}

	var primaries []Node
	var replicas []Node
	for _, n := range downstream {
		if !n.IsDown() {
			if db, ok := n.(*Database); ok {
				if db.IsReplica {
					replicas = append(replicas, n)
				} else {
					primaries = append(primaries, n)
				}
			} else {
				primaries = append(primaries, n)
			}
		}
	}

	avgPrimary := 0.0
	if len(primaries) > 0 {
		sum := 0.0
		for _, p := range primaries {
			sum += p.CurrentLatency()
		}
		avgPrimary = sum / float64(len(primaries))
	}

	avgReplica := 0.0
	if len(replicas) > 0 {
		sum := 0.0
		for _, rep := range replicas {
			sum += rep.CurrentLatency()
		}
		avgReplica = sum / float64(len(replicas))
	} else {
		avgReplica = avgPrimary // fallback
	}

	// Weighted average based on ReadRatio
	latency := (r.ReadRatio * avgReplica) + ((1.0 - r.ReadRatio) * avgPrimary)
	return latency + 1.0 // + 1ms overhead
}

func (r *DBRouter) ResetQueues() {} // No internal queue
