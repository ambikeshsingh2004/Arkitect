package engine

// DBRouter splits traffic into reads (70%) and writes (30%)
// Writes go to primary (IsReplica: false)
// Reads go to replicas (IsReplica: true)
type DBRouter struct {
	BaseNode
	throughput float64
}

// NewDBRouter creates a new DBRouter node.
func NewDBRouter(id, label string) *DBRouter {
	return &DBRouter{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "dbrouter",
			NodeLabel: label,
		},
	}
}

// Process splits incoming RPS 3:7 into writes and reads.
func (r *DBRouter) Process() {
	if r.Down {
		r.throughput = 0
		r.Incoming = 0
		return
	}

	incoming := r.Incoming
	r.Incoming = 0
	r.throughput = incoming

	downstream := r.Downstream()
	if len(downstream) == 0 || incoming == 0.0 {
		return
	}

	writeTraffic := incoming * 0.3
	readTraffic := incoming * 0.7

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
				// fallback if connected to non-db
				primaries = append(primaries, n)
			}
		}
	}

	// Forward writes to primaries
	if len(primaries) > 0 {
		perPrimary := writeTraffic / float64(len(primaries))
		for _, p := range primaries {
			p.AddIncoming(perPrimary)
		}
	}

	// Forward reads to replicas (fallback to primary if no replicas)
	if len(replicas) > 0 {
		perReplica := readTraffic / float64(len(replicas))
		for _, rep := range replicas {
			rep.AddIncoming(perReplica)
		}
	} else if len(primaries) > 0 {
		// No replicas? All traffic goes to primary
		perPrimary := readTraffic / float64(len(primaries))
		for _, p := range primaries {
			p.AddIncoming(perPrimary)
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
		ID:          r.NodeID,
		Type:        r.NodeType,
		Label:       r.NodeLabel,
		Utilization: util,
		Latency:     1.0, // slight routing overhead
		Throughput:  r.throughput,
		Status:      StatusFromUtilization(util, 0, r.Down),
	}
}
