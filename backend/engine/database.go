package engine

import "math"

// Database models a database node — terminal sink with capacity constraints.
// When incoming + queued exceeds MaxRPS, only MaxRPS queries are processed per tick.
type Database struct {
	BaseNode
	CapacityRPS float64
	BaseLatency float64 // ms

	queueDepth       float64
	throughput       float64
	dropped          float64 // drops THIS tick
	totalDropped     float64 // accumulated drops since start
	utilization      float64
	IsReplica        bool
	ConcurrencyLimit float64
}

// NewDatabase creates a new Database node.
func NewDatabase(id, label string, maxRPS, baseLatency float64) *Database {
	return &Database{
		BaseNode: BaseNode{
			NodeID:    id,
			NodeType:  "database",
			NodeLabel: label,
		},
		CapacityRPS: maxRPS,
		BaseLatency: baseLatency,
	}
}

// Process handles incoming traffic with capacity constraints.
// If this node is DOWN, it is skipped entirely.
func (d *Database) Process() {
	if d.Down {
		d.throughput = 0
		d.utilization = 0
		d.dropped = 0
		d.Incoming = 0
		return
	}

	queueDelay := 0.0
	if d.CapacityRPS > 0 {
		queueDelay = (d.queueDepth / d.CapacityRPS) * 1000.0
	}
	totalLatency := d.BaseLatency + queueDelay

	effectiveCapacity := d.CapacityRPS
	if d.ConcurrencyLimit > 0 && totalLatency > 0 {
		eff := (d.ConcurrencyLimit / totalLatency) * 1000.0
		if eff < effectiveCapacity {
			effectiveCapacity = eff
		}
	}

	incoming := d.Incoming
	d.Incoming = 0

	totalArrival := incoming + d.queueDepth
	processed := math.Min(totalArrival, effectiveCapacity)
	d.throughput = processed

	d.queueDepth = math.Max(0.0, totalArrival-processed)

	maxQueue := d.CapacityRPS * 5.0
	if d.queueDepth > maxQueue {
		d.dropped = d.queueDepth - maxQueue
		d.totalDropped += d.dropped
		d.queueDepth = maxQueue
	} else {
		d.dropped = 0
	}

	if d.CapacityRPS > 0.0 {
		sutil := incoming / d.CapacityRPS
		d.utilization = math.Min(sutil, 1.0)
	}
}

func (d *Database) CurrentLatency() float64 {
	queueDelay := 0.0
	if d.CapacityRPS > 0 {
		queueDelay = (d.queueDepth / d.CapacityRPS) * 1000.0
	}
	return d.BaseLatency + queueDelay
}

func (d *Database) GetMetrics() NodeMetrics {
	lat := d.CurrentLatency()
	return NodeMetrics{
		ID:          d.NodeID,
		Type:        d.NodeType,
		Label:       d.NodeLabel,
		Utilization: d.utilization,
		Latency:     lat,
		QueueDepth:  d.queueDepth,
		Throughput:  d.throughput,
		Dropped:     d.totalDropped,
		DropRate:    d.dropped,
		Status:      StatusFromUtilization(d.utilization, d.queueDepth, d.Down),
	}
}

func (d *Database) MaxRPS() float64 {
	return d.CapacityRPS
}
