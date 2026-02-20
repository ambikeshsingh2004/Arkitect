import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Users } from 'lucide-react';

function ClientNode({ data }) {
  const rps = data.metrics?.throughput || data.rps || 0;
  const handleClass = "!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-[#0a0a0c]";

  return (
    <div className="node-card border-2 border-emerald-500/30 shadow-emerald-500/10 min-w-[140px] hover:scale-[1.02]">
      <Handle type="source" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
          <Users className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{data.label || 'Client'}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Traffic Source</p>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <div className="bg-white/5 rounded-lg p-2 text-center">
        <p className="text-slate-500 text-[10px]">Sending</p>
        <p className="text-emerald-400 font-mono font-bold text-sm">{rps} <span className="text-[10px] text-slate-500">rps</span></p>
      </div>
    </div>
  );
}

export default memo(ClientNode);
