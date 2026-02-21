package engine

// Client represents the traffic source / entry point node.
// It simply receives injected traffic and forwards it all downstream.
type Client struct {
	BaseNode
	throughput float64
}

// NewClient creates a new Client node.
func NewClient(id, label string) *Client {
	return &Client{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "client",
			NodeLabel: label,
		},
	}
}

// Process forwards all incoming traffic to downstream nodes.
func (c *Client) Process() {
	incoming := c.Incoming
	c.Incoming = 0 // reset incoming immediately after capturing

	c.throughput = incoming
	downstream := c.Downstream()
	// Forward to healthy nodes only
	var healthy []Node
	for _, node := range downstream {
		if !node.IsDown() {
			healthy = append(healthy, node)
		}
	}

	if len(healthy) > 0 && incoming > 0.0 {
		perNode := incoming / float64(len(healthy))
		for _, node := range healthy {
			node.AddIncoming(perNode)
		}
	}
}

// GetMetrics returns the current metrics for this client.
func (c *Client) GetMetrics() NodeMetrics {
	return NodeMetrics{
		ID:         c.NodeID,
		Type:       c.NodeType,
		Label:      c.NodeLabel,
		Throughput: c.throughput,
		Status:     "healthy",
	}
}

func (c *Client) MaxRPS() float64 {
	return 0
}
func (c *Client) CurrentLatency() float64 {
	downstream := c.Downstream()
	if len(downstream) == 0 {
		return 0
	}
	sum := 0.0
	for _, node := range downstream {
		sum += node.CurrentLatency()
	}
	return sum / float64(len(downstream))
}
