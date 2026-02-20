package engine

// LoadBalancer distributes incoming traffic across downstream nodes using Round Robin.
// DOWN nodes are excluded from routing, causing traffic redistribution.
type LoadBalancer struct {
	BaseNode
	rrIndex    int
	throughput float64
}

// NewLoadBalancer creates a new LoadBalancer node.
func NewLoadBalancer(id, label string) *LoadBalancer {
	return &LoadBalancer{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "loadbalancer",
			NodeLabel: label,
		},
	}
}

// Process distributes all incoming RPS across healthy downstream nodes.
// DOWN nodes are skipped — their traffic is redistributed to remaining UP nodes.
func (lb *LoadBalancer) Process() {
	if lb.Down {
		lb.throughput = 0
		return
	}

	lb.throughput = lb.Incoming
	downstream := lb.Downstream()
	if len(downstream) == 0 || lb.Incoming == 0 {
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
		// All downstream nodes are DOWN — traffic is dropped
		return
	}

	// Round-robin: distribute evenly across alive nodes
	perNode := lb.Incoming / float64(len(alive))
	for _, node := range alive {
		node.AddIncoming(perNode)
	}
}

// GetMetrics returns the current metrics for this load balancer.
func (lb *LoadBalancer) GetMetrics() NodeMetrics {
	util := 0.0
	if lb.throughput > 0 {
		util = 0.1 // always low since LB doesn't constrain
	}
	return NodeMetrics{
		ID:          lb.NodeID,
		Type:        lb.NodeType,
		Label:       lb.NodeLabel,
		Utilization: util,
		Latency:     0.5, // negligible routing latency
		QueueDepth:  0,
		Throughput:  lb.throughput,
		Dropped:     0,
		Status:      StatusFromUtilization(util, 0, lb.Down),
	}
}
