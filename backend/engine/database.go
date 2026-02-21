package engine

import "math"

// Database models a database node — terminal sink with capacity constraints.
// When incoming + queued exceeds MaxRPS, only MaxRPS queries are processed per tick.
type Database struct {
	BaseNode
	MaxRPS      float64
	BaseLatency float64 // ms

	queueDepth   float64
	throughput   float64
	dropped      float64 // drops THIS tick
	totalDropped float64 // accumulated drops since start
	latency      float64
	utilization  float64
	IsReplica    bool
}

// NewDatabase creates a new Database node.
func NewDatabase(id, label string, maxRPS, baseLatency float64) *Database {
	return &Database{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "database",
			NodeLabel: label,
		},
		MaxRPS:      maxRPS,
		BaseLatency: baseLatency,
	}
}

// Process handles incoming traffic with capacity constraints.
// If this node is DOWN, it is skipped entirely.
func (d *Database) Process() {
	if d.Down {
		d.throughput = 0
		d.latency = 0
		d.utilization = 0
		d.dropped = 0
		d.Incoming = 0 // consume incoming
		return
	}

	incoming := d.Incoming
	d.Incoming = 0 // reset incoming immediately after capturing

	totalArrival := incoming + d.queueDepth

	processed := math.Min(totalArrival, d.MaxRPS)
	d.throughput = processed

	d.queueDepth = math.Max(0.0, totalArrival-processed)

	// Drop if queue exceeds 5x capacity
	maxQueue := d.MaxRPS * 5.0
	if d.queueDepth > maxQueue {
		d.dropped = d.queueDepth - maxQueue
		d.totalDropped += d.dropped // accumulate
		d.queueDepth = maxQueue
	} else {
		d.dropped = 0
	}

	// Utilization = incoming / capacity
	if d.MaxRPS > 0.0 {
		d.utilization = math.Min(incoming/d.MaxRPS, 1.0)
	}

	// Latency = baseLatency + queue wait time (seconds → ms)
	d.latency = d.BaseLatency
	if d.MaxRPS > 0.0 {
		d.latency += (d.queueDepth / d.MaxRPS) * 1000.0
	}
	// No downstream — database is a terminal node.
}

// GetMetrics returns the current metrics for this database.
func (d *Database) GetMetrics() NodeMetrics {
	return NodeMetrics{
		ID:          d.NodeID,
		Type:        d.NodeType,
		Label:       d.NodeLabel,
		Utilization: d.utilization,
		Latency:     d.latency,
		QueueDepth:  d.queueDepth,
		Throughput:  d.throughput,
		Dropped:     d.totalDropped,
		Status:      StatusFromUtilization(d.utilization, d.queueDepth, d.Down),
	}
}
