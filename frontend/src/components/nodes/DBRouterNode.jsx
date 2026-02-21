import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Split } from 'lucide-react';

function DBRouterNode({ data }) {
  const status = data.metrics?.status || 'idle';
  const throughput = data.metrics?.throughput || 0;

  const handleClass = "!w-3 !h-3 !bg-violet-500 !border-2 !border-[#050507] hover:!scale-125 transition-transform";

  const auraColors = {
    active: 'bg-violet-500/10',
    down: 'bg-rose-500/15',
    idle: 'bg-slate-500/5',
  };

  const currentStatus = status === 'down' ? 'down' : status === 'idle' ? 'idle' : 'active';

  return (
    <div className={`node-card group min-w-[180px] shadow-2xl ${status === 'down' ? 'node-down' : ''}`}>
      <div className={`status-aura ${auraColors[currentStatus]}`} />
      
      <Handle type="target" position={Position.Left} className={handleClass} />
      <Handle type="source" position={Position.Right} className={handleClass} />

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 group-hover:rotate-12 transition-transform duration-500">
          <Split className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-white truncate leading-none mb-1 uppercase tracking-tight">{data.label || 'DB Router'}</p>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Traffic Splitter</span>
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'down' ? 'bg-rose-500' : 'bg-violet-500'} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-2xl p-3 border border-white/5 space-y-2">
        <div className="flex justify-between items-center bg-orange-400/5 p-2 rounded-xl border border-orange-400/10 transition-colors hover:bg-orange-400/10">
          <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest">Write (30%)</span>
          <span className="text-[9px] text-orange-400/60 font-black uppercase tracking-tighter">Primary</span>
        </div>
        <div className="flex justify-between items-center bg-cyan-400/5 p-2 rounded-xl border border-cyan-400/10 transition-colors hover:bg-cyan-400/10">
          <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Read (70%)</span>
          <span className="text-[9px] text-cyan-400/60 font-black uppercase tracking-tighter">Replicas</span>
        </div>
      </div>

      {status !== 'idle' ? (
        <div className="mt-4 pt-3 border-t border-white/5 text-center">
          <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mb-0.5">Aggregated Flow</p>
          <p className="text-violet-400 font-black text-sm tabular-nums tracking-tight">
            {throughput.toFixed(0)} <span className="text-[10px] opacity-60">rps</span>
          </p>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest opacity-40">Standby Mode</p>
        </div>
      )}
    </div>
  );
}

export default memo(DBRouterNode);
