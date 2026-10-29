import React from 'react';
import { Terminal } from 'lucide-react';

export function SimulationDrawer({
  expandedInputs,
  inputStates,
  toggleInputSignal,
}) {
  return (
    <div className="h-40 bg-[#292524] border-t border-[#44403c] flex flex-col z-20">
      <div className="h-9 px-4 bg-[#1c1917]/80 flex items-center justify-between border-b border-[#44403c]">
        <span className="text-xs font-bold uppercase tracking-wider text-[#a8a29e] flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#f59e0b]" />
          Real-Time Logic Simulation Inputs
        </span>
      </div>

      <div className="flex-1 p-3 overflow-auto bg-[#1c1917]/30 flex flex-wrap gap-2 items-center">
        {expandedInputs?.map((inpName) => {
          const val = inputStates[inpName] ?? 0;
          return (
            <button
              key={inpName}
              onClick={() => toggleInputSignal(inpName)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all active:scale-95 ${
                val === 1
                  ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981] shadow-sm shadow-[#10b981]/20'
                  : 'bg-[#1c1917] border-[#44403c] text-[#a8a29e]'
              }`}
            >
              <span>{inpName}</span>
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${val === 1 ? 'bg-[#10b981] text-slate-950' : 'bg-[#44403c] text-white'}`}
              >
                {val}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
