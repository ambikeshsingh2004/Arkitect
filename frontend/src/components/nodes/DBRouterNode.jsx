import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Split } from 'lucide-react';

function DBRouterNode({ data }) {
  const status = data.metrics?.status || 'idle';
  const throughput = data.metrics?.throughput || 0;

  const handleClass = "!w-2.5 !h-2.5 !bg-violet-500 !border-2 !border-[#0a0a0c]";

  return (
    <div className={`node-card border-2 min-w-[170px] border-violet-500/40 shadow-violet-500/10 hover:scale-[1.02]`}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <Handle type="source" position={Position.Right} className={handleClass} />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-violet-500/15 text-violet-400">
          <Split className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">{data.label || 'DB Router'}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Read/Write Split</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`w-2 h-2 rounded-full ${status === 'down' ? 'bg-rose-500' : 'bg-violet-500'} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
          {status !== 'idle' && (
            <span className={`text-[7px] font-bold px-1 py-0.5 rounded border ${
              status === 'down' ? 'text-rose-400 border-rose-500/30' : 'text-violet-400 border-violet-500/30'
            }`}>
              {status === 'down' ? 'DOWN' : 'ACTIVE'}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="bg-white/5 rounded-lg p-2 flex justify-between items-center">
          <span className="text-[10px] text-orange-400 font-medium">WRITE (30%)</span>
          <span className="text-[10px] text-orange-400 font-mono">Primary</span>
        </div>
        <div className="bg-white/5 rounded-lg p-2 flex justify-between items-center">
          <span className="text-[10px] text-cyan-400 font-medium">READ (70%)</span>
          <span className="text-[10px] text-cyan-400 font-mono">Replicas</span>
        </div>
      </div>

      {status !== 'idle' && (
        <div className="mt-3 bg-violet-500/10 rounded-lg p-1.5 text-center border border-violet-500/20">
          <p className="text-slate-500 text-[9px]">Total Throughput</p>
          <p className="text-violet-400 font-mono font-bold text-[11px]">{throughput.toFixed(0)} rps</p>
        </div>
      )}
    </div>
  );
}

export default memo(DBRouterNode);
