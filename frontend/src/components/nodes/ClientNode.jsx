import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Users } from 'lucide-react';

function ClientNode({ data }) {
  const rps = data.metrics?.throughput || data.rps || 0;
  const handleClass = "!w-3 !h-3 !bg-emerald-500 !border-2 !border-[#050507] hover:!scale-125 transition-transform";

  return (
    <div className="node-card group min-w-[160px] shadow-2xl">
      <div className="status-aura bg-emerald-500/10" />
      
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:rotate-12 transition-transform duration-500">
          <Users className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-white truncate leading-none mb-1 uppercase tracking-tight">{data.label || 'Client Source'}</p>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Load Generator</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5 space-y-4">
        <div className="text-center">
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">Current Demand</p>
          <p className="text-white font-black text-2xl tabular-nums tracking-tighter">
            {rps} <span className="text-xs text-slate-500 font-bold ml-1 uppercase">RPS</span>
          </p>
        </div>
        
        {data.metrics && (
          <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
            <div className="text-center group/metric transition-all">
              <p className="text-[8px] text-cyan-400 font-black uppercase tracking-widest mb-1 group-hover/metric:scale-110">Read</p>
              <p className="text-xs font-black text-white tabular-nums">{data.metrics.readThroughput?.toFixed(0) || 0}</p>
            </div>
            <div className="text-center group/metric transition-all">
              <p className="text-[8px] text-rose-400 font-black uppercase tracking-widest mb-1 group-hover/metric:scale-110">Write</p>
              <p className="text-xs font-black text-white tabular-nums">{data.metrics.writeThroughput?.toFixed(0) || 0}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ClientNode);
