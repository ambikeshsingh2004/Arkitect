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
    idle: 'border-blue-500/20 shadow-blue-500/5',
  };

  const glowColors = {
    healthy: 'bg-emerald-500',
    stressed: 'bg-amber-500',
    overloaded: 'bg-rose-500',
    idle: 'bg-blue-500',
  };

  const handleClass = "!w-3 !h-3 !bg-blue-500 !border-2 !border-[#050507] hover:!scale-125 transition-transform";

  const auraColors = {
    healthy: 'bg-emerald-500/10',
    stressed: 'bg-amber-500/10',
    overloaded: 'bg-rose-500/10',
    idle: 'bg-blue-500/5',
  };

  return (
    <div className={`node-card group min-w-[190px] shadow-2xl ${status === 'down' ? 'node-down' : ''}`}>
      <div className={`status-aura ${auraColors[status]}`} />
      
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
            <Share2 className="w-4 h-4" />
          </div>
          {status !== 'idle' && (
            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#050507] ${glowColors[status]} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-white truncate leading-none mb-1 uppercase tracking-tight">{data.label || 'Load Balancer'}</p>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Routing Hub</span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm border ${
              status === 'healthy' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' :
              status === 'stressed' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
              status === 'overloaded' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' :
              'text-slate-500 border-slate-500/20 bg-slate-500/5'
            }`}>
              {status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {status !== 'idle' ? (
        <div className="space-y-3">
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 space-y-2.5">
            <div className="space-y-1">
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-center">Traffic Arrival (R / W)</p>
              <div className="flex justify-between items-center px-2">
                <span className="text-xs text-cyan-400 font-black tabular-nums">{data.metrics?.arrivalRead?.toFixed(0) || 0}</span>
                <div className="w-px h-3 bg-white/10" />
                <span className="text-xs text-rose-400 font-black tabular-nums">{data.metrics?.arrivalWrite?.toFixed(0) || 0}</span>
              </div>
            </div>
            <div className="w-full h-px bg-white/5" />
            <div className="space-y-1">
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-center">Output Throughput</p>
              <div className="flex justify-between items-center px-2">
                <span className="text-xs text-cyan-400 font-black tabular-nums">{data.metrics?.readThroughput?.toFixed(0) || 0}</span>
                <div className="w-px h-3 bg-white/10" />
                <span className="text-xs text-rose-400 font-black tabular-nums">{data.metrics?.writeThroughput?.toFixed(0) || 0}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.02] rounded-xl p-2 border border-white/5 text-center">
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mb-0.5">Total RPS</p>
              <p className="text-white font-black text-sm tabular-nums tracking-tight">{throughput.toFixed(0)}</p>
            </div>
            <div className="bg-white/[0.02] rounded-xl p-2 border border-white/5 text-center">
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mb-0.5">Capacity</p>
              <p className="text-blue-400 font-black text-sm tabular-nums tracking-tight">{(utilization * 100).toFixed(0)}%</p>
            </div>
          </div>

        </div>
      ) : (
        <div className="py-6 text-center border-t border-white/5 mt-2">
          <p className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">Idle State</p>
        </div>
      )}
    </div>
  );
}

export default memo(LoadBalancerNode);
