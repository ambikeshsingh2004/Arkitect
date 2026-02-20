import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Server } from 'lucide-react';

function AppServerNode({ data }) {
  const status = data.metrics?.status || 'idle';
  const utilization = data.metrics?.utilization || 0;
  const latency = data.metrics?.latency || 0;
  const queueDepth = data.metrics?.queueDepth || 0;
  const throughput = data.metrics?.throughput || 0;

  const statusColors = {
    healthy: 'border-emerald-500/40 shadow-emerald-500/10',
    stressed: 'border-amber-500/40 shadow-amber-500/10',
    overloaded: 'border-rose-500/40 shadow-rose-500/10',
    idle: 'border-indigo-500/20 shadow-indigo-500/5',
  };

  const glowColors = {
    healthy: 'bg-emerald-500',
    stressed: 'bg-amber-500',
    overloaded: 'bg-rose-500',
    idle: 'bg-indigo-500',
  };

  const utilizationBarColor = utilization > 0.85 ? 'bg-rose-500' : utilization > 0.6 ? 'bg-amber-500' : 'bg-emerald-500';
  const handleClass = "!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-[#0a0a0c]";

  return (
    <div className={`node-card border-2 min-w-[170px] ${statusColors[status]} ${status === 'down' ? 'node-down' : ''} hover:scale-[1.02]`}>
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
          <Server className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{data.label || 'App Server'}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">App Server</p>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${glowColors[status]} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
      </div>

      {status !== 'idle' && (
        <>
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-500">CPU Utilization</span>
              <span className="text-indigo-400 font-mono">{(utilization * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full ${utilizationBarColor} rounded-full transition-all duration-500 ease-out`} style={{ width: `${Math.min(utilization * 100, 100)}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <div className="bg-white/5 rounded-lg p-1.5 text-center">
              <p className="text-slate-500 text-[9px]">Latency</p>
              <p className="text-indigo-400 font-mono font-bold text-[11px]">{latency.toFixed(0)}ms</p>
            </div>
            <div className="bg-white/5 rounded-lg p-1.5 text-center">
              <p className="text-slate-500 text-[9px]">RPS</p>
              <p className="text-indigo-400 font-mono font-bold text-[11px]">{throughput.toFixed(0)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-1.5 text-center">
              <p className="text-slate-500 text-[9px]">Queue</p>
              <p className="text-indigo-400 font-mono font-bold text-[11px]">{queueDepth.toFixed(0)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(AppServerNode);
