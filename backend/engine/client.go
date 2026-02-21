package engine

// Client represents the traffic source / entry point node.
// It simply receives injected traffic and forwards it all downstream.
type Client struct {
	BaseNode
	RPS        float64
	ReadRatio  float64 // 0.0 to 1.0
	throughput float64
	readTP     float64
	writeTP    float64
}

// NewClient creates a new Client node.
func NewClient(id, label string) *Client {
	return &Client{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "client",
			NodeLabel: label,
		},
		ReadRatio: 0.7, // Default 70% reads
	}
}

// Process forwards all incoming traffic to downstream nodes.
func (c *Client) Process() {
	incoming := c.Incoming
	inRead := c.IncomingRead
	inWrite := c.IncomingWrite

	// If traffic was injected as single bucket, split it here
	if incoming > 0 && inRead == 0 && inWrite == 0 {
		readRatio := c.ReadRatio
		inRead = incoming * readRatio
		inWrite = incoming * (1.0 - readRatio)
	}

	c.ResetIncoming()

	// If we performed a local split of generic 'Incoming' traffic,
	// update the arrival metrics now so the UI shows the split.
	if incoming > 0 && c.lastArrivalR == 0 && c.lastArrivalW == 0 {
		c.lastArrivalR = inRead
		c.lastArrivalW = inWrite
	}

	c.throughput = inRead + inWrite
	c.readTP = inRead
	c.writeTP = inWrite

	downstream := c.Downstream()
	var healthy []Node
	for _, node := range downstream {
		if !node.IsDown() {
			healthy = append(healthy, node)
		}
	}

	if len(healthy) > 0 {
		if inRead > 0 {
			perNode := inRead / float64(len(healthy))
			for _, node := range healthy {
				node.AddIncomingRead(perNode)
			}
		}
		if inWrite > 0 {
			perNode := inWrite / float64(len(healthy))
			for _, node := range healthy {
				node.AddIncomingWrite(perNode)
			}
		}
	}
}

// GetMetrics returns the current metrics for this client.
func (c *Client) GetMetrics() NodeMetrics {
	return NodeMetrics{
		ID:              c.NodeID,
		Type:            c.NodeType,
		Label:           c.NodeLabel,
		ReadThroughput:  c.readTP,
		WriteThroughput: c.writeTP,
		Throughput:      c.throughput,
		Status:          "healthy",
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
func (c *Client) ResetQueues() {} // No queue for client
