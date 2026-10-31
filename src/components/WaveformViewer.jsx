import React, { useState, useEffect } from 'react';
import { Play, Pause, StepForward, RotateCcw } from 'lucide-react';

export function WaveformViewer({
  simulator,
  inputs = {},
  onToggleInput,
  onStepClock,
  onResetSimulator,
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [clockSpeedMs, setClockSpeedMs] = useState(600);
  const [selectedCycle, setSelectedCycle] = useState(null);

  // Auto-running clock interval
  useEffect(() => {
    let timer = null;
    if (isRunning) {
      timer = setInterval(() => {
        if (onStepClock) onStepClock();
      }, clockSpeedMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, clockSpeedMs, onStepClock]);

  const history = simulator?.history || [];
  const displayHistory = history.slice(-16); // Show up to last 16 cycles

  // Collect all tracked signals
  const allSignals = Object.keys(
    history.length > 0 ? history[history.length - 1].signals : inputs
  ).filter((s) => s !== '0' && s !== '1');

  // Separate inputs, clocks, registers, and outputs
  const clkSignals = allSignals.filter((s) => s.toLowerCase().includes('clk'));
  const otherSignals = allSignals.filter((s) => !s.toLowerCase().includes('clk'));
  const trackedSignals = [...clkSignals, ...otherSignals];

  const cycleCount = displayHistory.length;

  return (
    <div className="flex flex-col h-full bg-[#181615] text-[#d6d3d1] select-none">
      {/* Control Toolbar */}
      <div className="h-12 bg-[#22201e] px-4 border-b border-[#3b3836] flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onStepClock && onStepClock()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3b3836] hover:bg-[#4a4643] text-amber-400 font-semibold rounded-lg transition-colors border border-[#57534e]"
            title="Step clock posedge"
          >
            <StepForward size={14} /> Step Clock
          </button>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg transition-colors border ${
              isRunning
                ? 'bg-rose-900/60 border-rose-500 text-rose-300'
                : 'bg-emerald-900/60 border-emerald-500 text-emerald-300'
            }`}
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
            {isRunning ? 'Pause' : 'Run Clock'}
          </button>
          <button
            onClick={() => {
              setIsRunning(false);
              if (onResetSimulator) onResetSimulator();
            }}
            className="p-1.5 hover:text-white hover:bg-[#3b3836] rounded-lg transition-colors text-[#a8a29e]"
            title="Reset history"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs text-[#a8a29e]">
          <span>Speed:</span>
          <select
            value={clockSpeedMs}
            onChange={(e) => setClockSpeedMs(Number(e.target.value))}
            className="bg-[#181615] border border-[#44403c] rounded px-2 py-1 text-xs text-[#d6d3d1]"
          >
            <option value={1000}>1.0s (1 Hz)</option>
            <option value={500}>0.5s (2 Hz)</option>
            <option value={250}>0.25s (4 Hz)</option>
          </select>
          <span className="font-mono text-amber-400">
            Cycle: {history.length > 0 ? history[history.length - 1].cycle : 0}
          </span>
        </div>
      </div>

      {/* Waveform Canvas Area */}
      <div className="flex-1 overflow-auto p-4">
        {displayHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#78716c] space-y-2">
            <span>No simulation cycles recorded yet.</span>
            <button
              onClick={() => onStepClock && onStepClock()}
              className="px-3 py-1.5 bg-[#292524] hover:bg-[#3b3836] text-amber-400 font-semibold rounded-lg text-xs border border-[#44403c]"
            >
              Step Clock to Start Waveform
            </button>
          </div>
        ) : (
          <div className="min-w-[600px]">
            {/* Timeline Cycle Header */}
            <div className="flex items-center border-b border-[#3b3836] pb-2 mb-3 text-xs font-mono text-[#a8a29e]">
              <div className="w-28 flex-shrink-0 font-bold text-[#d6d3d1]">Signal</div>
              <div className="flex-1 flex">
                {displayHistory.map((h, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedCycle(h.cycle)}
                    className={`flex-1 text-center cursor-pointer transition-colors ${
                      selectedCycle === h.cycle ? 'text-amber-400 font-bold' : ''
                    }`}
                  >
                    T{h.cycle}
                  </div>
                ))}
              </div>
            </div>

            {/* Signal Traces */}
            <div className="space-y-3">
              {trackedSignals.map((sig) => {
                const isClk = sig.toLowerCase().includes('clk');
                const isInput = sig in inputs;

                return (
                  <div key={sig} className="flex items-center group">
                    {/* Signal Label & Toggle */}
                    <div className="w-28 flex-shrink-0 flex items-center justify-between pr-3">
                      <span
                        className={`font-mono text-xs truncate ${
                          isClk
                            ? 'text-amber-400 font-bold'
                            : isInput
                            ? 'text-[#d6d3d1]'
                            : 'text-[#a8a29e]'
                        }`}
                        title={sig}
                      >
                        {sig}
                      </span>
                      {isInput && onToggleInput && (
                        <button
                          onClick={() => onToggleInput(sig)}
                          className="text-[10px] px-1 py-0.5 bg-[#262423] hover:bg-amber-500 hover:text-black rounded text-amber-400 border border-[#44403c]"
                          title="Toggle input"
                        >
                          toggle
                        </button>
                      )}
                    </div>

                    {/* Digital Waveform Lane */}
                    <div className="flex-1 h-9 bg-[#1e1c1a] rounded border border-[#3b3836] flex items-center px-1">
                      {displayHistory.map((stepData, idx) => {
                        const val = stepData.signals[sig] ?? 0;
                        const prevVal =
                          idx > 0
                            ? displayHistory[idx - 1].signals[sig] ?? 0
                            : val;

                        return (
                          <div
                            key={idx}
                            className="flex-1 h-full flex flex-col justify-between py-1 relative cursor-pointer"
                            onClick={() => setSelectedCycle(stepData.cycle)}
                          >
                            <svg className="w-full h-full overflow-visible">
                              {/* Waveform line */}
                              <polyline
                                points={
                                  val === 1
                                    ? prevVal === 0
                                      ? '0,24 0,4 100,4'
                                      : '0,4 100,4'
                                    : prevVal === 1
                                    ? '0,4 0,24 100,24'
                                    : '0,24 100,24'
                                }
                                fill="none"
                                stroke={val ? '#10b981' : '#57534e'}
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                              />
                            </svg>
                            <span
                              className={`absolute right-1 text-[9px] font-mono ${
                                val ? 'text-emerald-400 top-0.5' : 'text-stone-500 bottom-0.5'
                              }`}
                            >
                              {val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
