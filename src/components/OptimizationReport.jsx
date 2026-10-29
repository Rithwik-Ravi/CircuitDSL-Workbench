import React from 'react';
import { TrendingDown, Scissors } from 'lucide-react';

export function OptimizationReport({ optStats }) {
  if (!optStats) return null;

  return (
    <div className="flex-1 p-4 bg-[#1c1917] overflow-auto text-xs space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-[#292524] rounded-2xl border border-[#44403c]">
          <span className="text-[#a8a29e] text-[10px] uppercase font-bold">
            Gate Reduction
          </span>
          <div className="text-xl font-bold text-[#f59e0b] flex items-center gap-1">
            <TrendingDown className="w-5 h-5 text-[#f59e0b]" />
            {optStats.reductionPct}%
          </div>
        </div>
        <div className="p-3 bg-[#292524] rounded-2xl border border-[#44403c]">
          <span className="text-[#a8a29e] text-[10px] uppercase font-bold">
            Initial Gates
          </span>
          <div className="text-xl font-bold text-[#fefae0]">
            {optStats.initialGateCount}
          </div>
        </div>
        <div className="p-3 bg-[#292524] rounded-2xl border border-[#44403c]">
          <span className="text-[#a8a29e] text-[10px] uppercase font-bold">
            Optimized Gates
          </span>
          <div className="text-xl font-bold text-[#10b981]">
            {optStats.optimizedGateCount}
          </div>
        </div>
      </div>

      <div className="bg-[#292524] rounded-2xl p-4 border border-[#44403c] space-y-2 font-mono">
        <span className="text-xs font-bold text-[#fefae0] block mb-2">
          Optimization Transformation Log:
        </span>
        {optStats.logs.length === 0 ? (
          <p className="text-[#a8a29e] italic">
            No dead code or redundant expressions detected.
          </p>
        ) : (
          optStats.logs.map((item, idx) => (
            <div
              key={idx}
              className="p-2 bg-[#1c1917] rounded-xl border border-[#44403c] flex items-center gap-2"
            >
              <Scissors className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
              <span className="text-[#10b981] font-bold">[{item.pass}]:</span>
              <span className="text-[#fefae0]">{item.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
