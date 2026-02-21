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
	n := float64(len(downstream))
	if n == 0.0 || incoming == 0.0 {
		return
	}

	perNode := incoming / n
	for _, node := range downstream {
		node.AddIncoming(perNode)
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
