import React, { useState, useEffect } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Clock, Sparkles } from 'lucide-react';

export function OptimizerTimeMachine({
  passes = [],
  activeSnapshotIndex = 0,
  onSelectSnapshot,
}) {
  const [isPlaying, setIsPlaying] = useState(false);

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
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, totalSnapshots, onSelectSnapshot]);

  if (totalSnapshots === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[#78716c]">
        Enable optimization to inspect per-pass time-machine snapshots.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#181615] text-[#d6d3d1] p-3 text-xs select-none">
      {/* Top Stepper Controls */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3b3836]">
        <div className="flex items-center space-x-2">
          <Clock className="text-amber-400" size={16} />
          <span className="font-bold text-white">Optimizer Time Machine</span>
          <span className="px-2 py-0.5 bg-[#292524] rounded text-amber-400 font-mono text-[11px]">
            {activeSnapshotIndex + 1} / {totalSnapshots}
          </span>
        </div>

        <div className="flex items-center space-x-2">
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
      <div className="mb-3 px-1">
        <div className="flex justify-between text-[11px] text-[#a8a29e] mb-1">
          <span className="font-semibold text-amber-400">{currentSnapshot.passName}</span>
          <span className="font-mono">Logic Gates: {currentSnapshot.gateCount}</span>
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

      {/* Pass Changes List */}
      <div className="flex-1 overflow-auto space-y-2 pr-1">
        {currentSnapshot.changes.length === 0 ? (
          <div className="p-3 bg-[#201e1c] rounded-lg border border-[#3b3836] text-[#a8a29e] text-center">
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
                    ? 'bg-rose-950/20 border-rose-800/40'
                    : isCSE
                    ? 'bg-amber-950/20 border-amber-800/40'
                    : 'bg-blue-950/20 border-blue-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-bold text-[11px] px-1.5 py-0.5 rounded ${
                      isDCE
                        ? 'bg-rose-900/40 text-rose-300'
                        : isCSE
                        ? 'bg-amber-900/40 text-amber-300'
                        : 'bg-blue-900/40 text-blue-300'
                    }`}
                  >
                    {ch.pass}
                  </span>
                  <span className="font-mono text-[#a8a29e] text-[10px]">
                    target: {ch.target}
                  </span>
                </div>

                <div className="font-mono text-[11px] mb-1 flex items-center gap-2">
                  <span className="text-[#a8a29e] line-through">{ch.before}</span>
                  <span className="text-[#78716c]">→</span>
                  <span className="text-white font-bold">{ch.after}</span>
                </div>

                <div className="text-[11px] text-[#d6d3d1] italic">
                  {ch.reason}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
