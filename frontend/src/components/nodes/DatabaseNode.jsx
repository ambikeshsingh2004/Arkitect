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

  const utilizationBarColor = utilization > 0.85 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : utilization > 0.6 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
  const handleClass = "!w-3 !h-3 !bg-rose-500 !border-2 !border-[#050507] hover:!scale-125 transition-transform";

  const auraColors = {
    healthy: 'bg-emerald-500/20',
    stressed: 'bg-amber-500/20',
    overloaded: 'bg-rose-500/20',
    idle: 'bg-rose-500/10',
  };

  return (
    <div className={`node-card group min-w-[180px] shadow-2xl ${status === 'down' ? 'node-down' : ''}`}>
      <div className={`status-aura ${auraColors[status]}`} />
      
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
            <Database className="w-4 h-4" />
          </div>
          {status !== 'idle' && (
            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#050507] ${glowColors[status]} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[13px] font-black text-white truncate leading-none uppercase tracking-tight">{data.label || 'Database'}</p>
            {data.isReplica && (
              <span className="text-[8px] font-black text-violet-400 bg-violet-400/10 border border-violet-400/20 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                Replica
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Storage Node</span>
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
        <div className="space-y-4">
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">IO Utilization</span>
              <span className="text-xs text-white font-black">{(utilization * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden p-[1px]">
              <div className={`h-full ${utilizationBarColor} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.min(utilization * 100, 100)}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.02] rounded-xl p-2.5 border border-white/5 text-center group/metric hover:bg-white/[0.05] transition-colors">
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-tighter mb-1 group-hover/metric:text-rose-400 transition-colors">IO Latency</p>
              <p className="text-white font-black text-sm tabular-nums tracking-tight">{latency.toFixed(0)}<span className="text-[10px] ml-0.5 opacity-40">ms</span></p>
            </div>
            <div className="bg-white/[0.02] rounded-xl p-2.5 border border-white/5 text-center group/metric hover:bg-white/[0.05] transition-colors">
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-tighter mb-1 group-hover/metric:text-cyan-400 transition-colors">Throughput</p>
              <p className="text-white font-black text-sm tabular-nums tracking-tight">{throughput.toFixed(0)}<span className="text-[10px] ml-0.5 opacity-40">rps</span></p>
            </div>
            <div className="bg-white/[0.02] rounded-xl p-2 border border-white/5 text-center col-span-2 flex items-center justify-between px-3">
              <span className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">Active Queue</span>
              <span className={`font-black text-xs tabular-nums ${queueDepth > 100 ? 'text-rose-400' : 'text-slate-300'}`}>
                {queueDepth.toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-4 text-center border-t border-white/5 mt-2">
          <p className="text-[10px] text-slate-600 font-medium italic">Unit Idle...</p>
        </div>
      )}
    </div>
  );
}

export default memo(DatabaseNode);
