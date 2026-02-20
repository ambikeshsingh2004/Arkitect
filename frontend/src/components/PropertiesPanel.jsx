import React from 'react';
import { X, Server, Database, Share2, Users, Power, PowerOff } from 'lucide-react';

// Default configs for each node type
const defaultConfigs = {
  client: { rps: 100 },
  loadbalancer: { algorithm: 'round-robin' },
  appserver: { maxRPS: 100, baseLatency: 20 },
  database: { maxRPS: 50, baseLatency: 50 },
};

const typeLabels = {
  client: 'Client',
  loadbalancer: 'Load Balancer',
  appserver: 'App Server',
  database: 'Database',
};

const typeIcons = {
  client: <Users className="w-4 h-4" />,
  loadbalancer: <Share2 className="w-4 h-4" />,
  appserver: <Server className="w-4 h-4" />,
  database: <Database className="w-4 h-4" />,
};

const typeColors = {
  client: 'emerald',
  loadbalancer: 'blue',
  appserver: 'indigo',
  database: 'rose',
};

export default function PropertiesPanel({ node, onClose, onUpdate, isRunning, onToggleDown, sessionId }) {
  if (!node) return null;

  const color = typeColors[node.type] || 'slate';
  const status = node.data.metrics?.status;
  const isDown = status === 'down';

  const handleChange = (field, value) => {
    onUpdate(node.id, { [field]: value });
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
                disabled={isRunning}
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
                  disabled={isRunning}
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
                  disabled={isRunning}
                  className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.baseLatency || 20}ms
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
                  disabled={isRunning}
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
                  disabled={isRunning}
                  className="flex-1 accent-rose-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded-md min-w-[48px] text-center">
                  {node.data.baseLatency || 50}ms
                </span>
              </div>
            </FieldGroup>
          </>
        )}

        {/* LB-specific: algorithm */}
        {node.type === 'loadbalancer' && (
          <FieldGroup label="Algorithm">
            <select
              value={node.data.algorithm || 'round-robin'}
              onChange={(e) => handleChange('algorithm', e.target.value)}
              disabled={isRunning}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
            >
              <option value="round-robin">Round Robin</option>
              <option value="least-connections">Least Connections</option>
            </select>
          </FieldGroup>
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
                <MetricCard label="Dropped" value={node.data.metrics.dropped?.toFixed(0)} warn />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {isRunning && node.type !== 'client' && (
        <div className="p-4 border-t border-white/5">
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
        </div>
      )}
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
