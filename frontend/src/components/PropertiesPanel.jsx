import React from 'react';
import { X, Server, Database, Share2, Users, Power, PowerOff, Copy, Trash2, Split } from 'lucide-react';

const typeLabels = {
  client: 'Client',
  loadbalancer: 'Load Balancer',
  appserver: 'App Server',
  database: 'Database',
  dbrouter: 'DB Router',
};

const typeIcons = {
  client: <Users className="w-4 h-4" />,
  loadbalancer: <Share2 className="w-4 h-4" />,
  appserver: <Server className="w-4 h-4" />,
  database: <Database className="w-4 h-4" />,
  dbrouter: <Split className="w-4 h-4" />,
};

const typeColors = {
  client: 'emerald',
  loadbalancer: 'blue',
  appserver: 'indigo',
  database: 'rose',
  dbrouter: 'violet',
};

export default function PropertiesPanel({ node, onClose, onUpdate, isRunning, onToggleDown, sessionId, onAddReplica, onRemoveNode }) {
  if (!node) return null;

  const color = typeColors[node.type] || 'slate';
  const status = node.data.metrics?.status;
  const isDown = status === 'down';

  // Update local state + send to backend if running
  const handleChange = async (field, value) => {
    onUpdate(node.id, { [field]: value });

    // Send live config to backend during simulation
    if (isRunning && sessionId) {
      try {
        const body = { nodeId: node.id };

        if (field === 'rps') {
          body.rps = value;
        } else if (field === 'maxRPS') {
          body.maxRPS = value;
        } else if (field === 'baseLatency') {
          body.baseLatency = value;
        } else if (field === 'backpressureEnabled') {
          body.backpressureEnabled = value;
        } else if (field === 'backpressureThreshold') {
          body.backpressureThreshold = value;
        } else if (field === 'algorithm') {
          body.algorithm = value;
        } else if (field === 'readRatio') {
          body.readRatio = value;
        } else if (field === 'concurrencyLimit') {
          body.concurrencyLimit = value;
        } else if (field === 'isReplica') {
          body.isReplica = value;
        }

        await fetch(`/api/simulate/${sessionId}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error('Failed to update config:', err);
      }
    }
  };

  return (
    <div className="w-72 border-l border-white/5 bg-[#0e0e11] flex flex-col shrink-0 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-${color}-500/15 text-${color}-400`}>
            {typeIcons[node.type]}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{node.data.label}</p>
            <p className="text-[10px] text-slate-500 uppercase">{typeLabels[node.type]}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Label */}
        <FieldGroup label="Label">
          <input
            type="text"
            value={node.data.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            disabled={isRunning}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
          />
        </FieldGroup>

        {/* Client-specific: RPS */}
        {node.type === 'client' && (
          <FieldGroup label="Requests per Second">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="1000"
                value={node.data.rps || 100}
                onChange={(e) => handleChange('rps', Number(e.target.value))}
                className="flex-1 accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                {node.data.rps || 100}
              </span>
            </div>
          </FieldGroup>
        )}

        {/* Server-specific: Max RPS & Base Latency */}
        {node.type === 'appserver' && (
          <>
            <FieldGroup label="Max Capacity (RPS)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={node.data.maxRPS || 100}
                  onChange={(e) => handleChange('maxRPS', Number(e.target.value))}
                  className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.maxRPS || 100}
                </span>
              </div>
            </FieldGroup>
            <FieldGroup label="Base Latency (ms)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={node.data.baseLatency || 20}
                  onChange={(e) => handleChange('baseLatency', Number(e.target.value))}
                  className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.baseLatency || 20}ms
                </span>
              </div>
            </FieldGroup>
            <FieldGroup label="Concurrency Limit">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={node.data.concurrencyLimit || 10}
                  onChange={(e) => handleChange('concurrencyLimit', Number(e.target.value))}
                  className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.concurrencyLimit || 10}
                </span>
              </div>
            </FieldGroup>
          </>
        )}

        {/* Database-specific: Max RPS & Base Latency */}
        {node.type === 'database' && (
          <>
            <FieldGroup label="Max Capacity (QPS)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="300"
                  value={node.data.maxRPS || 50}
                  onChange={(e) => handleChange('maxRPS', Number(e.target.value))}
                  className="flex-1 accent-rose-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.maxRPS || 50}
                </span>
              </div>
            </FieldGroup>
            <FieldGroup label="Base Latency (ms)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="500"
                  value={node.data.baseLatency || 50}
                  onChange={(e) => handleChange('baseLatency', Number(e.target.value))}
                  className="flex-1 accent-rose-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.baseLatency || 50}ms
                </span>
              </div>
            </FieldGroup>
            <FieldGroup label="Concurrency Limit">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={node.data.concurrencyLimit || 5}
                  onChange={(e) => handleChange('concurrencyLimit', Number(e.target.value))}
                  className="flex-1 accent-rose-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.concurrencyLimit || 5}
                </span>
              </div>
            </FieldGroup>
          </>
        )}

        {node.type === 'loadbalancer' && (
          <>
            <FieldGroup label="Max Capacity (RPS)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="2000"
                  value={node.data.maxRPS || 500}
                  onChange={(e) => handleChange('maxRPS', Number(e.target.value))}
                  className="flex-1 accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.maxRPS || 500}
                </span>
              </div>
            </FieldGroup>
            <FieldGroup label="Algorithm">
              <select
                value={node.data.algorithm || 'round-robin'}
                onChange={(e) => handleChange('algorithm', e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                style={{ backgroundColor: '#111827' }} // Force dark background for options in some browsers
              >
                <option value="round-robin" className="bg-slate-900">Round Robin</option>
                <option value="weighted" className="bg-slate-900">Divide by Capacity</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Backpressure Control">
              <div className="space-y-3">
                <button
                  onClick={() => handleChange('backpressureEnabled', !node.data.backpressureEnabled)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                    node.data.backpressureEnabled
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <span className="text-xs font-medium">Reject Load {'>'} {(node.data.backpressureThreshold * 100 || 90).toFixed(0)}%</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${node.data.backpressureEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${node.data.backpressureEnabled ? 'left-4.5' : 'left-0.5'}`} />
                  </div>
                </button>
                
                {node.data.backpressureEnabled && (
                  <div className="px-1">
                    <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-tight">Threshold Limit</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0.5"
                        max="0.95"
                        step="0.05"
                        value={node.data.backpressureThreshold || 0.9}
                        onChange={(e) => handleChange('backpressureThreshold', Number(e.target.value))}
                        className="flex-1 accent-amber-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-center min-w-[32px]">
                        {(node.data.backpressureThreshold * 100 || 90).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </FieldGroup>
          </>
        )}

        {/* Live Metrics (during simulation) */}
        {isRunning && node.data.metrics && node.type !== 'client' && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Live Metrics</p>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Utilization" value={`${(node.data.metrics.utilization * 100).toFixed(0)}%`} />
              <MetricCard label="Latency" value={`${node.data.metrics.latency?.toFixed(0)}ms`} />
              <MetricCard label="Throughput" value={node.data.metrics.throughput?.toFixed(0)} />
              <MetricCard label="Queue" value={node.data.metrics.queueDepth?.toFixed(0)} />
              {node.data.metrics.dropped > 0 && (
                <MetricCard label="Total Dropped" value={node.data.metrics.dropped?.toFixed(0)} warn />
              )}
            </div>
          </div>
        )}

        {isRunning && (
          <p className="text-[10px] text-emerald-500/60 italic">⚡ Changes apply instantly to live simulation</p>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/5 flex flex-col gap-2">
        {/* Add Replica — only for database nodes when not running */}
        {!isRunning && node.type === 'database' && (
          <button
            onClick={() => onAddReplica(node.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25"
          >
            <Copy className="w-4 h-4" />
            Add Replica
          </button>
        )}

        {/* Toggle UP/DOWN — during simulation */}
        {isRunning && node.type !== 'client' && (
          <div className="space-y-2 text-center">
            <button
              onClick={() => onToggleDown(node.id, !isDown)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                isDown
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
              }`}
            >
              {isDown ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              {isDown ? 'Bring UP' : 'Take DOWN'}
            </button>
            <p className="text-[10px] text-slate-500 italic">
              {isDown ? 'Restore node to service' : 'Simulate a node failure'}
            </p>
          </div>
        )}

        {/* Remove node — only when not running */}
        {!isRunning && (
          <button
            onClick={() => onRemoveNode(node.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/30"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        )}
        {node.type === 'dbrouter' && (
          <>
            <FieldGroup label="Read/Write Split">
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold">
                  <span className="text-cyan-400">Reads: {(node.data.readRatio * 100 || 70).toFixed(0)}%</span>
                  <span className="text-rose-400">Writes: {((1 - (node.data.readRatio || 0.7)) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={node.data.readRatio || 0.7}
                    onChange={(e) => handleChange('readRatio', Number(e.target.value))}
                    className="flex-1 accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <p className="text-[9px] text-slate-500 leading-tight">
                  Adjust the portion of traffic directed to Read Replicas vs Primaries.
                </p>
              </div>
            </FieldGroup>
          </>
        )}
      </div>
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({ label, value, warn }) {
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center">
      <p className="text-slate-500 text-[9px]">{label}</p>
      <p className={`font-mono font-bold text-xs ${warn ? 'text-rose-400' : 'text-slate-300'}`}>{value}</p>
    </div>
  );
}
