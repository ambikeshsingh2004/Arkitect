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
	c.throughput = c.Incoming
	downstream := c.Downstream()
	n := len(downstream)
	if n == 0 || c.Incoming == 0 {
		return
	}

	perNode := c.Incoming / float64(n)
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
