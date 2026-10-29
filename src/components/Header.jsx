import React from 'react';
import {
  Cpu,
  CheckCircle,
  XCircle,
  Download,
  Scissors,
  FileCode,
  Code,
  Table,
} from 'lucide-react';
import { PRESET_EXAMPLES } from '../utils/presets.js';
import { downloadFile, exportTruthTableCSV } from '../utils/exportUtils.js';

export function Header({
  activeExample,
  setActiveExample,
  setDslCode,
  enableOptimization,
  setEnableOptimization,
  compilerResult,
  truthTable,
}) {
  return (
    <header className="h-16 bg-[#292524] border-b border-[#44403c] px-4 flex items-center justify-between z-20 shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#c25e00] via-[#d97706] to-[#f59e0b] flex items-center justify-center shadow-lg shadow-[#c25e00]/20">
          <Cpu className="w-6 h-6 text-slate-950" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold tracking-tight text-[#fefae0]">
              Circuit DSL Workbench
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 border ${
                compilerResult.hasErrors
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30'
              }`}
            >
              {compilerResult.hasErrors ? (
                <XCircle className="w-3 h-3 text-rose-400" />
              ) : (
                <CheckCircle className="w-3 h-3 text-[#10b981]" />
              )}
              {compilerResult.hasErrors
                ? 'Compilation Errors'
                : 'Pipeline Valid'}
            </span>
          </div>
          <p className="text-xs text-[#a8a29e]">
            Lexer • Parser • AST • SSA IR • Optimizer • Verilog • Simulator
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => setEnableOptimization(!enableOptimization)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
            enableOptimization
              ? 'bg-[#c25e00]/20 text-[#f59e0b] border-[#c25e00]/50 shadow-inner'
              : 'bg-[#1c1917] text-[#a8a29e] border-[#44403c]'
          }`}
        >
          <Scissors className="w-4 h-4 text-[#f59e0b]" />
          Optimizer: {enableOptimization ? 'ON' : 'OFF'}
        </button>

        <select
          value={activeExample}
          onChange={(e) => {
            setActiveExample(e.target.value);
            setDslCode(PRESET_EXAMPLES[e.target.value]);
          }}
          className="px-3 py-2 bg-[#1c1917] border border-[#44403c] rounded-xl text-xs text-[#fefae0] hover:border-[#78716c] focus:outline-none cursor-pointer"
        >
          <optgroup label="⚡ Compiler Optimization Demos">
            <option value="optimizationTest">
              Demo: Dead Code & CSE Optimization
            </option>
            <option value="constantFoldingDemo">
              Demo: Constant Folding & Simplification
            </option>
          </optgroup>

          <optgroup label="🔣 Combinational Logic">
            <option value="adder">4-bit Ripple Carry Adder</option>
            <option value="mux">2-to-1 Multiplexer</option>
            <option value="alu">1-bit Simple ALU</option>
          </optgroup>

          <optgroup label="🔄 Sequential Logic">
            <option value="dff">Sequential D Flip-Flop</option>
          </optgroup>

          <optgroup label="📝 Custom Workspace">
            <option value="custom">+ Blank Template / Scratchpad</option>
          </optgroup>
        </select>

        <div className="relative group">
          <button className="px-3 py-2 bg-[#1c1917] hover:bg-[#44403c] border border-[#44403c] rounded-xl text-xs font-semibold text-[#fefae0] flex items-center gap-1.5 transition-colors">
            <Download className="w-3.5 h-3.5 text-[#f59e0b]" />
            Export
          </button>
          <div className="absolute right-0 top-full mt-1 w-52 bg-[#292524] border border-[#44403c] rounded-xl shadow-2xl py-1 hidden group-hover:block z-50">
            <button
              onClick={() =>
                downloadFile(
                  compilerResult.verilog,
                  'circuit.v',
                  'text/x-verilog'
                )
              }
              className="w-full text-left px-3 py-2 text-xs text-[#fefae0] hover:bg-[#44403c] flex items-center gap-2"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" /> Verilog HDL
              (.v)
            </button>
            <button
              onClick={() =>
                downloadFile(
                  JSON.stringify(compilerResult.ast, null, 2),
                  'ast.json',
                  'application/json'
                )
              }
              className="w-full text-left px-3 py-2 text-xs text-[#fefae0] hover:bg-[#44403c] flex items-center gap-2"
            >
              <Code className="w-3.5 h-3.5 text-emerald-400" /> AST Netlist
              (.json)
            </button>
            <button
              onClick={() => exportTruthTableCSV(truthTable)}
              className="w-full text-left px-3 py-2 text-xs text-[#fefae0] hover:bg-[#44403c] flex items-center gap-2"
            >
              <Table className="w-3.5 h-3.5 text-blue-400" /> Truth Table (.csv)
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
