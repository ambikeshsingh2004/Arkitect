import React from 'react';
import { X, Server, Database, Share2, Users, Power, PowerOff, Copy, Trash2, Split, RefreshCcw, Activity } from 'lucide-react';

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

export default function PropertiesPanel({ 
  node, 
  onClose, 
  onUpdate, 
  isRunning, 
  onToggleDown, 
  sessionId, 
  onAddReplica, 
  onRemoveNode,
  onResetQueues 
}) {
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

  const accentColorMap = {
    emerald: 'text-emerald-400 accent-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 accent-blue-500 bg-blue-500/10 border-blue-500/20',
    indigo: 'text-indigo-400 accent-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    rose: 'text-rose-400 accent-rose-500 bg-rose-500/10 border-rose-500/20',
    violet: 'text-violet-400 accent-violet-500 bg-violet-500/10 border-violet-500/20',
  };

  const accentClasses = accentColorMap[color];

  return (
    <div className="w-80 border-l border-white/5 bg-[#0e0e11]/95 backdrop-blur-xl flex flex-col shrink-0 animate-slide-in shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl border ${accentClasses} shadow-lg group hover:scale-110 transition-transform duration-500`}>
            {typeIcons[node.type]}
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-tight leading-none mb-1">{node.data.label}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{typeLabels[node.type]}</span>
              {isRunning && (
                <span className={`w-1.5 h-1.5 rounded-full ${isDown ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`} />
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
        {/* Label */}
        <FieldGroup label="Identification">
          <input
            type="text"
            value={node.data.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            disabled={isRunning}
            placeholder="Node Name"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 disabled:opacity-30 transition-all placeholder:text-slate-700"
          />
        </FieldGroup>

        <div className="space-y-6">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Configuration</p>
          
          {/* Client-specific: RPS & ReadRatio */}
          {node.type === 'client' && (
            <>
              <FieldGroup label="Traffic Intensity">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Demand Pulse</span>
                    <span className="text-xs text-emerald-400 font-black tabular-nums">{node.data.rps || 100} RPS</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="2000"
                    value={node.data.rps || 100}
                    onChange={(e) => handleChange('rps', Number(e.target.value))}
                    className="w-full h-1.5 accent-emerald-500"
                  />
                </div>
              </FieldGroup>
              <FieldGroup label="Workload Balance">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest leading-none">
                    <span className="text-cyan-400">R: {((node.data.readRatio || 0.7) * 100).toFixed(0)}%</span>
                    <span className="text-rose-400">W: {((1 - (node.data.readRatio || 0.7)) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={node.data.readRatio || 0.7}
                    onChange={(e) => handleChange('readRatio', Number(e.target.value))}
                    className="w-full h-1.5 accent-cyan-500"
                  />
                </div>
              </FieldGroup>
            </>
          )}

          {/* Server-specific: Max RPS & Base Latency */}
          {node.type === 'appserver' && (
            <>
              <FieldGroup label="Processing Capacity">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Max TPS</span>
                    <span className="text-xs text-indigo-400 font-black tabular-nums">{node.data.maxRPS || 100}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="2000"
                    value={node.data.maxRPS || 100}
                    onChange={(e) => handleChange('maxRPS', Number(e.target.value))}
                    className="w-full h-1.5 accent-indigo-500"
                  />
                </div>
              </FieldGroup>
              <FieldGroup label="Compute Latency">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Baseline</span>
                    <span className="text-xs text-indigo-400 font-black tabular-nums">{node.data.baseLatency || 20}ms</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="200"
                    value={node.data.baseLatency || 20}
                    onChange={(e) => handleChange('baseLatency', Number(e.target.value))}
                    className="w-full h-1.5 accent-indigo-500"
                  />
                </div>
              </FieldGroup>
            </>
          )}

          {/* Database-specific: Max RPS & Base Latency */}
          {node.type === 'database' && (
            <>
              <FieldGroup label="IO Throughput">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Max QPS</span>
                    <span className="text-xs text-rose-400 font-black tabular-nums">{node.data.maxRPS || 50}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    value={node.data.maxRPS || 50}
                    onChange={(e) => handleChange('maxRPS', Number(e.target.value))}
                    className="w-full h-1.5 accent-rose-500"
                  />
                </div>
              </FieldGroup>
              <FieldGroup label="Storage Latency">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Baseline</span>
                    <span className="text-xs text-rose-400 font-black tabular-nums">{node.data.baseLatency || 50}ms</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    value={node.data.baseLatency || 50}
                    onChange={(e) => handleChange('baseLatency', Number(e.target.value))}
                    className="w-full h-1.5 accent-rose-500"
                  />
                </div>
              </FieldGroup>
            </>
          )}

          {node.type === 'loadbalancer' && (
            <>
              <FieldGroup label="Routing Capacity">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Max Pulse</span>
                    <span className="text-xs text-blue-400 font-black tabular-nums">{node.data.maxRPS || 500}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="5000"
                    value={node.data.maxRPS || 500}
                    onChange={(e) => handleChange('maxRPS', Number(e.target.value))}
                    className="w-full h-1.5 accent-blue-500"
                  />
                </div>
              </FieldGroup>
              <FieldGroup label="Distribution Algorithm">
                <div className="relative group">
                  <select
                    value={node.data.algorithm || 'round-robin'}
                    onChange={(e) => handleChange('algorithm', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:outline-none focus:border-blue-500/40 appearance-none cursor-pointer tracking-tight"
                  >
                    <option value="round-robin">Round Robin</option>
                    <option value="weighted">Capacity Weighted</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-blue-400 transition-colors">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              </FieldGroup>
            </>
          )}
        </div>

        {/* Live Metrics (during simulation) */}
        {isRunning && node.data.metrics && (
          <div className="space-y-4 animate-slide-in">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Runtime Telemetry</p>
            <div className={`grid ${node.type === 'client' ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5`}>
              {node.type !== 'client' && <MetricCard label="Efficiency" value={`${(node.data.metrics.utilization * 100).toFixed(0)}%`} color={color} />}
              {node.type !== 'client' && <MetricCard label="MS Latency" value={`${node.data.metrics.latency?.toFixed(0)}`} color={color} />}
              
              {/* Throttling Diagnostic */}
              {node.type !== 'client' && node.data.metrics.effectiveCapacity > 0 && 
               node.data.metrics.effectiveCapacity < (node.data.maxRPS || 100) && (
                <div className="col-span-2 bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                  <div className="flex justify-between items-center">
                    <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest">Cap Throttled</p>
                    <span className="text-rose-400 font-black text-sm">{node.data.metrics.effectiveCapacity?.toFixed(1)} <span className="text-[9px] opacity-70">rps</span></span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-tight font-medium">Restricted by downstream latency and concurrency exhaustion.</p>
                </div>
              )}

              {/* Read/Write Breakdown */}
              <div className="col-span-2 bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-2 group hover:bg-white/[0.05] transition-colors">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>Flow Breakdown</span>
                    <Activity className="w-3 h-3 group-hover:animate-pulse" />
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex-1">
                       <p className="text-[8px] text-cyan-400 font-black uppercase">Read Pulse</p>
                       <p className="text-lg font-black text-white tabular-nums">{node.data.metrics.readThroughput?.toFixed(0) || 0}</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="flex-1">
                       <p className="text-[8px] text-rose-400 font-black uppercase">Write Pulse</p>
                       <p className="text-lg font-black text-white tabular-nums">{node.data.metrics.writeThroughput?.toFixed(0) || 0}</p>
                    </div>
                 </div>
              </div>

              {node.type !== 'client' && <MetricCard label="In-Flight" value={node.data.metrics.queueDepth?.toFixed(0)} color={color} />}
              {node.data.metrics.dropped > 0 && <MetricCard label="Load Rejected" value={node.data.metrics.dropped?.toFixed(0)} warn color="rose" />}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-white/5 flex flex-col gap-3 bg-gradient-to-t from-white/[0.02] to-transparent">
        {node.type === 'database' && (
          <button
            onClick={() => onAddReplica(node.id)}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-violet-600 text-white shadow-lg hover:shadow-violet-600/40 hover:-translate-y-1 active:translate-y-0"
          >
            <Copy className="w-4 h-4" />
            Provision Replica
          </button>
        )}

        {/* Toggle UP/DOWN */}
        {isRunning && node.type !== 'client' && (
          <button
            onClick={() => onToggleDown(node.id, !isDown)}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${
              isDown
                ? 'bg-emerald-500 text-black shadow-lg hover:shadow-emerald-500/40'
                : 'bg-rose-500 text-white shadow-lg hover:shadow-rose-500/40'
            }`}
          >
            {isDown ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            {isDown ? 'RECOVER SYSTEM' : 'SIMULATE CRASH'}
          </button>
        )}

        {/* Reset */}
        {isRunning && (node.type === 'appserver' || node.type === 'database') && (
          <button
            onClick={onResetQueues}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-amber-500/20 text-amber-500 border border-amber-500/30 hover:bg-amber-500/30"
          >
            <RefreshCcw className="w-4 h-4" />
            Flush Pipeline
          </button>
        )}

        {/* Remove node */}
        {!isRunning && (
          <button
            onClick={() => onRemoveNode(node.id)}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-white/5 text-slate-500 border border-white/5 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20"
          >
            <Trash2 className="w-4 h-4" />
            Delete Entity
          </button>
        )}
      </div>
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({ label, value, warn, color }) {
  const accentColors = {
    emerald: 'text-emerald-400 group-hover:text-emerald-300',
    blue: 'text-blue-400 group-hover:text-blue-300',
    indigo: 'text-indigo-400 group-hover:text-indigo-300',
    rose: 'text-rose-400 group-hover:text-rose-300',
    violet: 'text-violet-400 group-hover:text-violet-300',
  };

  return (
    <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 text-center transition-all hover:bg-white/[0.05] group">
      <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 opacity-80 group-hover:opacity-100 transition-opacity">{label}</p>
      <p className={`font-black text-lg tabular-nums tracking-tighter transition-colors ${warn ? 'text-rose-500' : accentColors[color] || 'text-white'}`}>{value}</p>
    </div>
  );
}
