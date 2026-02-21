import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Database } from 'lucide-react';

function DatabaseNode({ data }) {
  const status = data.metrics?.status || 'idle';
  const utilization = data.metrics?.utilization || 0;
  const latency = data.metrics?.latency || 0;
  const queueDepth = data.metrics?.queueDepth || 0;
  const throughput = data.metrics?.throughput || 0;

  const statusColors = {
    healthy: 'border-emerald-500/40 shadow-emerald-500/10',
    stressed: 'border-amber-500/40 shadow-amber-500/10',
    overloaded: 'border-rose-500/40 shadow-rose-500/10',
    idle: 'border-rose-500/20 shadow-rose-500/5',
  };

  const glowColors = {
    healthy: 'bg-emerald-500',
    stressed: 'bg-amber-500',
    overloaded: 'bg-rose-500',
    idle: 'bg-rose-500',
  };

  const utilizationBarColor = utilization > 0.85 ? 'bg-rose-500' : utilization > 0.6 ? 'bg-amber-500' : 'bg-emerald-500';
  const handleClass = "!w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-[#0a0a0c]";

  return (
    <div className={`node-card border-2 min-w-[170px] ${statusColors[status]} ${status === 'down' ? 'node-down' : ''} hover:scale-[1.02]`}>
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
          <Database className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-white">{data.label || 'Database'}</p>
            {data.isReplica && (
              <span className="text-[8px] font-bold text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Replica
              </span>
            )}
          </div>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Database</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`w-2 h-2 rounded-full ${glowColors[status]} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
          {status !== 'idle' && (
            <span className={`text-[7px] font-bold px-1 py-0.5 rounded border ${
              status === 'healthy' ? 'text-emerald-400 border-emerald-500/30' :
              status === 'stressed' ? 'text-amber-400 border-amber-500/30' :
              status === 'overloaded' ? 'text-rose-400 border-rose-500/30' :
              'text-slate-500 border-slate-500/30'
            }`}>
              {status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {status !== 'idle' && (
        <>
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-500">IO Utilization</span>
              <span className="text-rose-400 font-mono">{(utilization * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full ${utilizationBarColor} rounded-full transition-all duration-500 ease-out`} style={{ width: `${Math.min(utilization * 100, 100)}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <div className="bg-white/5 rounded-lg p-1.5 text-center">
              <p className="text-slate-500 text-[9px]">Latency</p>
              <p className="text-rose-400 font-mono font-bold text-[11px]">{latency.toFixed(0)}ms</p>
            </div>
            <div className="bg-white/5 rounded-lg p-1.5 text-center flex flex-col gap-0.5">
              <p className="text-slate-500 text-[8px]">Arrival (R / W)</p>
              <div className="flex justify-between items-center px-0.5">
                <span className="text-cyan-400 font-mono font-bold text-[9px]">{data.metrics?.arrivalRead?.toFixed(0) || 0}</span>
                <span className="text-white/20 text-[8px]">/</span>
                <span className="text-rose-400 font-mono font-bold text-[9px]">{data.metrics?.arrivalWrite?.toFixed(0) || 0}</span>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-1.5 text-center">
              <p className="text-slate-500 text-[8px]">Queue</p>
              <p className="text-rose-400 font-mono font-bold text-[10px]">{queueDepth.toFixed(0)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(DatabaseNode);
