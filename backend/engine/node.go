package engine

// NodeMetrics holds the real-time metrics for a single node.
type NodeMetrics struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Label       string  `json:"label"`
	Utilization float64 `json:"utilization"`
	Latency     float64 `json:"latency"`
	QueueDepth  float64 `json:"queueDepth"`
	Throughput  float64 `json:"throughput"`
	Dropped     float64 `json:"dropped"`
	DropRate    float64 `json:"dropRate"`
	Status      string  `json:"status"` // "healthy", "stressed", "overloaded", "down"
}

// Node is the common interface for all simulation nodes.
type Node interface {
	ID() string
	Type() string
	Label() string
	Process()
	AddIncoming(rps float64)
	ResetIncoming()
	GetMetrics() NodeMetrics
	SetDownstream(nodes []Node)
	Downstream() []Node
	SetDown(down bool)
	IsDown() bool
	MaxRPS() float64
}

// ---- Base node with shared fields ----

// BaseNode provides shared fields and methods for all node types.
type BaseNode struct {
	NodeID          string
	NodeType        string
	NodeLabel       string
	DownstreamNodes []Node
	Incoming        float64
	Down            bool // UP/DOWN status
}

func (b *BaseNode) ID() string                 { return b.NodeID }
func (b *BaseNode) Type() string               { return b.NodeType }
func (b *BaseNode) Label() string              { return b.NodeLabel }
func (b *BaseNode) AddIncoming(rps float64)    { b.Incoming += rps }
func (b *BaseNode) ResetIncoming()             { b.Incoming = 0 }
func (b *BaseNode) SetDownstream(nodes []Node) { b.DownstreamNodes = nodes }
func (b *BaseNode) Downstream() []Node         { return b.DownstreamNodes }
func (b *BaseNode) SetDown(down bool)          { b.Down = down }
func (b *BaseNode) IsDown() bool               { return b.Down }

// StatusFromUtilization returns a health status string.
// It considers both utilization and queue depth for a realistic assessment:
// - "overloaded": queue is growing (can't keep up with demand)
// - "stressed": high utilization but handling load (no significant queue)
// - "healthy": comfortable utilization
func StatusFromUtilization(u float64, queueDepth float64, isDown bool) string {
	if isDown {
		return "down"
	}
	switch {
	case queueDepth > 0 && u >= 0.85:
		return "overloaded"
	case u >= 0.70:
		return "stressed"
	default:
		return "healthy"
	}
}
