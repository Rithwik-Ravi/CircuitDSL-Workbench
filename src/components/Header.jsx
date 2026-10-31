import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  Share2,
  Download,
  Play,
  Wand2,
  Sun,
  Moon,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { PRESET_EXAMPLES, PRESET_METADATA } from '../utils/presets.js';
import { encodeShareUrl, exportIRJson, exportSchematicSVG } from '../utils/shareUtils.js';
import { downloadFile, exportTruthTableCSV } from '../utils/exportUtils.js';

export function Header({
  activeExample,
  setActiveExample,
  setDslCode,
  enableOptimization,
  setEnableOptimization,
  compilerResult,
  truthTable,
  onCompile,
  theme,
  setTheme,
  onOpenReverseMode,
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = () => {
    const url = encodeShareUrl(compilerResult.ast ? compilerResult.verilog ? compilerResult.source : '' : '');
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const isEquivalent = compilerResult.equivalence?.equivalent;

  return (
    <header className="h-14 bg-[#201e1c] border-b border-[#3b3836] px-4 flex items-center justify-between z-20 shadow-md select-none text-xs">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#c25e00] to-amber-500 flex items-center justify-center shadow-md shadow-amber-900/30">
          <Cpu className="w-5 h-5 text-black" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              CircuitDSL <span className="text-amber-500 font-mono text-xs">Workbench v2</span>
            </h1>

            {/* Verified Equivalent Badge (Headline Feature) */}
            {compilerResult.equivalence && (
              <span
                className={`px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 border text-[11px] ${
                  isEquivalent
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                    : 'bg-rose-950/60 text-rose-400 border-rose-700/60'
                }`}
                title={
                  isEquivalent
                    ? `Formally verified equivalent against original IR (${compilerResult.equivalence.verifiedVectors} vectors tested)`
                    : 'Equivalence violation detected!'
                }
              >
                {isEquivalent ? (
                  <>
                    <ShieldCheck size={12} className="text-emerald-400" />
                    <span>Verified Equivalent</span>
                  </>
                ) : (
                  <>
                    <XCircle size={12} className="text-rose-400" />
                    <span>Equivalence Mismatch</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center Controls: Examples Dropdown */}
      <div className="flex items-center space-x-2">
        <span className="text-[#a8a29e] hidden md:inline">Examples:</span>
        <select
          value={activeExample}
          onChange={(e) => {
            const val = e.target.value;
            setActiveExample(val);
            if (PRESET_EXAMPLES[val]) {
              setDslCode(PRESET_EXAMPLES[val]);
            }
          }}
          className="bg-[#181615] border border-[#44403c] rounded-lg px-2.5 py-1.5 text-xs text-[#e7e5e4] focus:outline-none focus:border-amber-500 transition-colors"
        >
          {Object.entries(PRESET_EXAMPLES).map(([key]) => {
            const meta = PRESET_METADATA[key] || { title: key };
            return (
              <option key={key} value={key}>
                {meta.title}
              </option>
            );
          })}
        </select>

        {/* Compile Button */}
        <button
          onClick={onCompile}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c25e00] hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm transition-all"
          title="Compile Circuit (Ctrl/Cmd+Enter)"
        >
          <Play size={12} /> Compile
        </button>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Reverse Mode Button */}
        <button
          onClick={onOpenReverseMode}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#292524] hover:bg-[#383330] text-amber-400 border border-[#44403c] rounded-lg font-semibold transition-colors"
          title="Open Reverse Mode (Truth Table to Circuit)"
        >
          <Wand2 size={13} />
          <span className="hidden sm:inline">Reverse Mode</span>
        </button>

        {/* Optimization Toggle */}
        <button
          onClick={() => setEnableOptimization(!enableOptimization)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
            enableOptimization
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              : 'bg-[#292524] border-[#44403c] text-[#a8a29e]'
          }`}
          title="Toggle IR Optimization Passes"
        >
          <span>Optimizer:</span>
          <span className="font-bold">{enableOptimization ? 'ON' : 'OFF'}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#292524] hover:bg-[#383330] text-[#d6d3d1] border border-[#44403c] rounded-lg font-medium transition-colors"
          title="Copy shareable link"
        >
          <Share2 size={13} />
          <span className="hidden md:inline">{copiedShare ? 'Copied!' : 'Share'}</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#292524] hover:bg-[#383330] text-[#d6d3d1] border border-[#44403c] rounded-lg font-medium transition-colors"
          >
            <Download size={13} />
            <span className="hidden md:inline">Export</span>
            <ChevronDown size={11} />
          </button>

          {showExportMenu && (
            <div
              className="absolute right-0 mt-1 w-44 bg-[#262423] border border-[#44403c] rounded-xl shadow-2xl py-1 text-xs text-[#d6d3d1] z-50"
              onMouseLeave={() => setShowExportMenu(false)}
            >
              <button
                onClick={() => {
                  downloadFile(compilerResult.verilog, `${compilerResult.ast?.circuitName || 'circuit'}.v`, 'text/plain');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#3b3836] transition-colors"
              >
                Export Verilog (.v)
              </button>
              <button
                onClick={() => {
                  downloadFile(compilerResult.testbench, `${compilerResult.ast?.circuitName || 'circuit'}_tb.v`, 'text/plain');
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#3b3836] transition-colors"
              >
                Export Testbench (.v)
              </button>
              <button
                onClick={() => {
                  exportIRJson(compilerResult.rawIR, compilerResult.optimizedIR, compilerResult.ast);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#3b3836] transition-colors"
              >
                Export IR (.json)
              </button>
              <button
                onClick={() => {
                  exportTruthTableCSV(truthTable);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#3b3836] transition-colors"
              >
                Export Truth Table (.csv)
              </button>
              <button
                onClick={() => {
                  exportSchematicSVG('svg', `${compilerResult.ast?.circuitName || 'circuit'}_schematic.svg`);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#3b3836] transition-colors"
              >
                Export Schematic (.svg)
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 bg-[#292524] hover:bg-[#383330] text-[#a8a29e] hover:text-white border border-[#44403c] rounded-lg transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}
