import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Share2 } from 'lucide-react';

function LoadBalancerNode({ data }) {
  const status = data.metrics?.status || 'idle';
  const utilization = data.metrics?.utilization || 0;
  const throughput = data.metrics?.throughput || 0;

  const statusColors = {
    healthy: 'border-emerald-500/40 shadow-emerald-500/10',
    stressed: 'border-amber-500/40 shadow-amber-500/10',
    overloaded: 'border-rose-500/40 shadow-rose-500/10',
    rejecting: 'border-amber-500/60 shadow-amber-500/20',
    idle: 'border-blue-500/20 shadow-blue-500/5',
  };

  const glowColors = {
    healthy: 'bg-emerald-500',
    stressed: 'bg-amber-500',
    overloaded: 'bg-rose-500',
    rejecting: 'bg-amber-500',
    idle: 'bg-blue-500',
  };

  const handleClass = "!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-[#0a0a0c]";

  return (
    <div className={`node-card border-2 min-w-[160px] ${statusColors[status]} ${status === 'down' ? 'node-down' : ''} hover:scale-[1.02]`}>
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
          <Share2 className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{data.label || 'Load Balancer'}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Load Balancer</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`w-2 h-2 rounded-full ${glowColors[status]} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
          {status !== 'idle' && (
            <span className={`text-[7px] font-bold px-1 py-0.5 rounded border ${
              status === 'healthy' ? 'text-emerald-400 border-emerald-500/30' :
              status === 'stressed' ? 'text-amber-400 border-amber-500/30' :
              status === 'overloaded' ? 'text-rose-400 border-rose-500/30' :
              status === 'rejecting' ? 'text-amber-400 border-amber-500/30' :
              'text-slate-500 border-slate-500/30'
            }`}>
              {status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {status !== 'idle' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <p className="text-slate-500 text-[10px]">Throughput</p>
              <p className="text-blue-400 font-mono font-bold">{throughput.toFixed(0)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <p className="text-slate-500 text-[10px]">Util %</p>
              <p className="text-blue-400 font-mono font-bold">{(utilization * 100).toFixed(0)}%</p>
            </div>
          </div>

          {(data.backpressureEnabled || data.metrics?.dropped > 0) && (
            <div className={`rounded-lg p-1.5 text-center border ${
              data.metrics?.dropped > 0 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
              <p className="text-[9px] uppercase tracking-tighter">Backpressure</p>
              <p className="text-[10px] font-mono font-bold">
                {data.metrics?.dropRate > 0 ? `REJECTING: ${data.metrics.dropRate.toFixed(0)} RPS` : 'ENABLED'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(LoadBalancerNode);
