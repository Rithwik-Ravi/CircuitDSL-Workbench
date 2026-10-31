import React, { useState, useMemo } from 'react';
import { QuineMcCluskey } from '../compiler/quineMcCluskey.js';
import { Wand2, Send, RotateCcw, Check, Sparkles } from 'lucide-react';

export function ReverseModeModal({ onSendToEditor }) {
  const [numVars, setNumVars] = useState(3);
  const varNames = useMemo(() => ['a', 'b', 'c', 'd'].slice(0, numVars), [numVars]);

  const rowCount = 1 << numVars;
  // State for output values: '0', '1', or 'X'
  const [outputValues, setOutputValues] = useState(() => {
    // Default: Majority function for 3 vars (3, 5, 6, 7 are 1)
    const initial = {};
    for (let i = 0; i < 8; i++) {
      initial[i] = [3, 5, 6, 7].includes(i) ? '1' : '0';
    }
    return initial;
  });

  const toggleOutput = (rowIndex) => {
    setOutputValues((prev) => {
      const cur = prev[rowIndex] || '0';
      const next = cur === '0' ? '1' : cur === '1' ? 'X' : '0';
      return { ...prev, [rowIndex]: next };
    });
  };

  const handleVarCountChange = (n) => {
    setNumVars(n);
    const newCount = 1 << n;
    setOutputValues((prev) => {
      const next = {};
      for (let i = 0; i < newCount; i++) {
        next[i] = prev[i] || '0';
      }
      return next;
    });
  };

  // Run Quine-McCluskey minimization
  const qmResult = useMemo(() => {
    const minterms = [];
    const dontCares = [];

    for (let i = 0; i < rowCount; i++) {
      const val = outputValues[i] || '0';
      if (val === '1') minterms.push(i);
      else if (val === 'X') dontCares.push(i);
    }

    return QuineMcCluskey.minimize(varNames, minterms, dontCares);
  }, [varNames, outputValues, rowCount]);

  return (
    <div className="flex flex-col h-full bg-[#181615] text-[#d6d3d1] p-4 overflow-auto">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-[#3b3836] gap-3">
        <div className="flex items-center space-x-2">
          <Wand2 className="text-amber-400" size={18} />
          <h2 className="font-bold text-sm text-white">Reverse Mode: Truth Table to Circuit</h2>
          <span className="text-xs text-[#a8a29e]">(Quine-McCluskey & K-Map Minimizer)</span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span>Variables:</span>
          <div className="flex space-x-1 bg-[#262423] p-1 rounded-lg border border-[#44403c]">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => handleVarCountChange(n)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  numVars === n ? 'bg-[#c25e00] text-white' : 'text-[#a8a29e] hover:text-white'
                }`}
              >
                {n} vars
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const reset = {};
              for (let i = 0; i < rowCount; i++) reset[i] = '0';
              setOutputValues(reset);
            }}
            className="p-1 hover:text-white text-[#a8a29e]"
            title="Clear table to 0s"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={() => onSendToEditor && onSendToEditor(qmResult.dslCode)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs shadow-md transition-all"
          >
            <Send size={13} /> Send to Editor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Left: Interactive Editable Truth Table */}
        <div className="lg:col-span-5 flex flex-col bg-[#201e1c] p-3 rounded-xl border border-[#3b3836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400">Editable Truth Table</span>
            <span className="text-[11px] text-[#a8a29e]">Click output column to cycle: 0 → 1 → X</span>
          </div>

          <div className="overflow-auto flex-1 max-h-[420px]">
            <table className="w-full text-center border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#292524] text-[#a8a29e] border-b border-[#3b3836]">
                  <th className="py-1 px-2">#</th>
                  {varNames.map((v) => (
                    <th key={v} className="py-1 px-2">{v}</th>
                  ))}
                  <th className="py-1 px-2 text-amber-400">OUT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2a28]">
                {Array.from({ length: rowCount }).map((_, idx) => {
                  const val = outputValues[idx] || '0';
                  return (
                    <tr key={idx} className="hover:bg-[#2b2725] transition-colors">
                      <td className="py-1 px-2 text-[#78716c]">{idx}</td>
                      {varNames.map((_, bitIdx) => {
                        const bit = (idx >> (numVars - 1 - bitIdx)) & 1;
                        return (
                          <td key={bitIdx} className="py-1 px-2 text-[#d6d3d1]">
                            {bit}
                          </td>
                        );
                      })}
                      <td className="py-1 px-2">
                        <button
                          onClick={() => toggleOutput(idx)}
                          className={`w-7 h-6 rounded font-bold transition-all shadow-sm ${
                            val === '1'
                              ? 'bg-emerald-600 text-white'
                              : val === 'X'
                              ? 'bg-amber-600 text-white'
                              : 'bg-[#332f2c] text-[#a8a29e]'
                          }`}
                        >
                          {val}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: K-Map & Minimized Equation */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Karnaugh Map Display */}
          {qmResult.kmap && (
            <div className="bg-[#201e1c] p-3 rounded-xl border border-[#3b3836]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400">
                  Karnaugh Map ({qmResult.kmap.rowVars.join('')} \ {qmResult.kmap.colVars.join('')})
                </span>
                <span className="text-[11px] text-[#a8a29e]">Gray-Code Ordered Grid</span>
              </div>

              <div className="overflow-auto py-2">
                <table className="border-collapse text-center text-xs font-mono mx-auto">
                  <thead>
                    <tr>
                      <th className="p-2 border border-[#44403c] bg-[#292524] text-[#a8a29e]">
                        {qmResult.kmap.rowVars.join('')} \ {qmResult.kmap.colVars.join('')}
                      </th>
                      {qmResult.kmap.colLabels.map((c) => (
                        <th key={c} className="p-2 border border-[#44403c] bg-[#292524] text-amber-400">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {qmResult.kmap.grid.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="p-2 border border-[#44403c] bg-[#292524] text-amber-400 font-bold">
                          {qmResult.kmap.rowLabels[rIdx]}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-2 border border-[#44403c] font-bold text-sm w-12 h-10 transition-colors ${
                              cell === '1'
                                ? 'bg-emerald-950/70 text-emerald-400'
                                : cell === 'X'
                                ? 'bg-amber-950/70 text-amber-400'
                                : 'bg-[#181615] text-[#78716c]'
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Minimized Output & Code */}
          <div className="bg-[#201e1c] p-3 rounded-xl border border-[#3b3836] flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={14} /> Minimized Sum-of-Products (SOP)
              </span>
              <span className="text-xs text-[#a8a29e]">
                {qmResult.essentialImplicants.length} Essential Prime Implicant(s)
              </span>
            </div>

            <div className="p-2.5 bg-[#181615] rounded-lg border border-[#3b3836] font-mono text-xs text-amber-300 mb-3 select-all">
              {qmResult.verilogCode}
            </div>

            <div className="flex-1 flex flex-col min-h-[140px]">
              <span className="text-[11px] font-bold text-[#a8a29e] mb-1">Generated CircuitDSL:</span>
              <pre className="flex-1 p-2 bg-[#181615] rounded-lg border border-[#3b3836] font-mono text-xs text-[#d6d3d1] overflow-auto select-all">
                {qmResult.dslCode}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
