import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Sparkles,
  GitCommit,
  ListTree,
} from 'lucide-react';

export function OptimizerTimeMachine({
  passes = [],
  activeSnapshotIndex = 0,
  onSelectSnapshot,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('diff'); // 'diff' or 'ir'

  const totalSnapshots = passes.length;
  const currentSnapshot = passes[activeSnapshotIndex] || {
    passName: 'No Passes',
    ir: [],
    changes: [],
    gateCount: 0,
  };

  // Auto-play animation through passes
  useEffect(() => {
    let timer = null;
    if (isPlaying && totalSnapshots > 1) {
      timer = setInterval(() => {
        onSelectSnapshot((prev) => {
          if (prev >= totalSnapshots - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1400);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, totalSnapshots, onSelectSnapshot]);

  if (totalSnapshots === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[#78716c] p-4 text-center">
        Enable optimization to inspect per-pass time-machine snapshots.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#181615] text-[#d6d3d1] p-3 text-xs select-none">
      {/* Top Stepper Controls */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3b3836] shrink-0">
        <div className="flex items-center space-x-2">
          <Clock className="text-amber-400" size={15} />
          <span className="font-bold text-white tracking-wide">Optimizer Time Machine</span>
          <span className="px-2 py-0.5 bg-[#292524] rounded text-amber-400 font-mono text-[11px] border border-[#44403c]">
            {activeSnapshotIndex + 1} / {totalSnapshots}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex bg-[#242220] rounded-md p-0.5 border border-[#3b3836] text-[11px]">
            <button
              onClick={() => setViewMode('diff')}
              className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'diff'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-[#a8a29e] hover:text-white'
              }`}
            >
              <GitCommit size={11} /> Changes ({currentSnapshot.changes.length})
            </button>
            <button
              onClick={() => setViewMode('ir')}
              className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'ir'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-[#a8a29e] hover:text-white'
              }`}
            >
              <ListTree size={11} /> IR ({currentSnapshot.ir.length})
            </button>
          </div>

          <div className="h-4 w-px bg-[#3b3836]" />

          <button
            onClick={() => onSelectSnapshot(Math.max(0, activeSnapshotIndex - 1))}
            disabled={activeSnapshotIndex === 0}
            className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-inherit rounded hover:bg-[#292524] transition-colors"
            title="Previous pass"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-semibold rounded border border-amber-500/40 transition-colors"
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => onSelectSnapshot(Math.min(totalSnapshots - 1, activeSnapshotIndex + 1))}
            disabled={activeSnapshotIndex === totalSnapshots - 1}
            className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-inherit rounded hover:bg-[#292524] transition-colors"
            title="Next pass"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              onSelectSnapshot(0);
            }}
            className="p-1 hover:text-white text-[#a8a29e] hover:bg-[#292524] rounded transition-colors"
            title="Reset to Initial IR"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Snapshot Slider */}
      <div className="mb-2 px-1 shrink-0">
        <div className="flex justify-between items-center text-[11px] text-[#a8a29e] mb-1">
          <span className="font-semibold text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/40">
            {currentSnapshot.passName}
          </span>
          <span className="font-mono text-[#d6d3d1]">
            Active Gates:{' '}
            <span className="font-bold text-white">{currentSnapshot.gateCount}</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={totalSnapshots - 1}
          value={activeSnapshotIndex}
          onChange={(e) => onSelectSnapshot(Number(e.target.value))}
          className="w-full h-1.5 bg-[#292524] rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto space-y-2 pr-1 min-h-0">
        {viewMode === 'diff' ? (
          currentSnapshot.changes.length === 0 ? (
            <div className="p-4 bg-[#201e1c] rounded-lg border border-[#3b3836] text-[#a8a29e] text-center text-xs">
              {activeSnapshotIndex === 0
                ? 'Initial circuit IR state before optimization passes.'
                : 'Pass converged with no further modifications.'}
            </div>
          ) : (
            currentSnapshot.changes.map((ch, idx) => {
              const isDCE = ch.pass === 'DCE';
              const isCSE = ch.pass === 'CSE';

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isDCE
                      ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                      : isCSE
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      : 'bg-blue-950/20 border-blue-800/40 text-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`font-bold text-[11px] px-1.5 py-0.5 rounded ${
                        isDCE
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                          : isCSE
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                          : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                      }`}
                    >
                      {ch.pass}
                    </span>
                    <span className="font-mono text-[#a8a29e] text-[10px]">
                      target: <span className="text-white font-semibold">{ch.target}</span>
                    </span>
                  </div>

                  <div className="font-mono text-[11px] mb-1.5 flex flex-wrap items-center gap-2 bg-[#121110] p-1.5 rounded border border-[#2a2725]">
                    <span className="text-[#a8a29e] line-through break-all">{ch.before}</span>
                    <span className="text-[#f59e0b] font-bold">→</span>
                    <span className="text-white font-bold break-all">{ch.after}</span>
                  </div>

                  <div className="text-[11px] text-[#d6d3d1] italic leading-relaxed">
                    {ch.reason}
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Full IR Table View */
          <div className="bg-[#141211] rounded-lg border border-[#3b3836] overflow-hidden">
            <div className="px-3 py-1.5 bg-[#1f1d1b] border-b border-[#3b3836] text-[10px] uppercase font-mono text-[#a8a29e] grid grid-cols-12 gap-2">
              <span className="col-span-1">#</span>
              <span className="col-span-3">Target</span>
              <span className="col-span-3">Op</span>
              <span className="col-span-5">Args</span>
            </div>
            <div className="divide-y divide-[#262423] font-mono text-[11px]">
              {currentSnapshot.ir.map((instr, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 grid grid-cols-12 gap-2 hover:bg-[#1c1a18] transition-colors items-center"
                >
                  <span className="col-span-1 text-[#78716c] text-[10px]">{idx}</span>
                  <span className="col-span-3 text-amber-300 font-semibold truncate">
                    {instr.target}
                  </span>
                  <span className="col-span-3 text-emerald-400 font-bold">{instr.op}</span>
                  <span className="col-span-5 text-[#d6d3d1] truncate">
                    {(instr.args || []).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
