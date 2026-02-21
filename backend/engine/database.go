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
	readTP           float64
	writeTP          float64
	dropped          float64 // drops THIS tick
	totalDropped     float64 // accumulated drops since start
	utilization      float64
	IsReplica        bool
	ConcurrencyLimit float64
	effectiveLim     float64
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
		d.ResetIncoming()
		return
	}

	incomingRead := d.IncomingRead
	incomingWrite := d.IncomingWrite
	incomingTotal := d.Incoming + incomingRead + incomingWrite
	d.ResetIncoming()

	queueDelay := 0.0
	if d.CapacityRPS > 0 {
		queueDelay = (d.queueDepth / d.CapacityRPS) * 1000.0
	}
	totalLatency := d.BaseLatency + queueDelay

	effectiveCapacity := d.CapacityRPS
	if d.ConcurrencyLimit > 0 && totalLatency > 0 {
		// Signal unlimited/no bottleneck from this logic
		d.effectiveLim = 0
	} else {
		d.effectiveLim = 0
	}

	totalArrival := incomingTotal + d.queueDepth
	processed := math.Min(totalArrival, effectiveCapacity)
	d.throughput = processed

	if d.IsReplica {
		// Replicas get "Read Only" traffic. Even if a write accidentally hits them,
		// they treat all processed capacity as Read Throughput.
		d.writeTP = 0
		d.readTP = processed
	} else {
		// Primaries prioritize Writes over Reads, but allow arrival-based clearing.
		// We calculate what portion of the current arrival + queue corresponds to writes.
		ratio := 0.7 // Default if no traffic
		if incomingTotal > 0 {
			ratio = incomingWrite / incomingTotal
		}

		writeArrival := incomingWrite + (d.queueDepth * ratio)
		processedWrite := math.Min(writeArrival, processed)

		// If we are significantly over capacity, reserve at least 10% for Reads
		// to prevent permanent starvation of health checks or metadata.
		if processed > 5 && processedWrite > processed*0.9 {
			processedWrite = math.Floor(processed * 0.9)
		}

		d.writeTP = processedWrite
		d.readTP = math.Max(0, processed-processedWrite)
	}

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
		d.utilization = math.Min(incomingTotal/d.CapacityRPS, 1.0)
		if d.queueDepth > 0 || processed < totalArrival-0.1 {
			d.utilization = 1.0
		}
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
		ID:                d.NodeID,
		Type:              d.NodeType,
		Label:             d.NodeLabel,
		Utilization:       d.utilization,
		Latency:           lat,
		QueueDepth:        d.queueDepth,
		ReadThroughput:    d.readTP,
		WriteThroughput:   d.writeTP,
		Throughput:        d.throughput,
		Dropped:           d.totalDropped,
		DropRate:          d.dropped,
		Status:            StatusFromUtilization(d.utilization, d.queueDepth, d.Down),
		ArrivalRead:       d.lastArrivalR,
		ArrivalWrite:      d.lastArrivalW,
		ArrivalTotal:      d.lastArrivalT,
		EffectiveCapacity: d.effectiveLim,
	}
}

func (d *Database) MaxRPS() float64 {
	return d.CapacityRPS
}

func (d *Database) ResetQueues() {
	d.queueDepth = 0
	d.throughput = 0
}
