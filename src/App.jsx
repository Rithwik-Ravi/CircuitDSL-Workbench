import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Code2,
  Table,
  Radio,
  FileCode,
  Binary,
  Wand2,
  Activity,
  Layers,
  AlertCircle,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  ChevronsUpDown,
} from 'lucide-react';
import { compile, CircuitSimulator } from './compiler/index.js';
import { compileAsync } from './compiler/compilerClient.js';
import { PRESET_EXAMPLES } from './utils/presets.js';
import { decodeShareUrl } from './utils/shareUtils.js';
import { Header } from './components/Header.jsx';
import { CodeMirrorEditor } from './components/CodeMirrorEditor.jsx';
import { SchematicView } from './components/SchematicView.jsx';
import { DiagnosticsPanel } from './components/DiagnosticsPanel.jsx';
import { WaveformViewer } from './components/WaveformViewer.jsx';
import { ReverseModeModal } from './components/ReverseModeModal.jsx';
import { OptimizerTimeMachine } from './components/OptimizerTimeMachine.jsx';
import { PipelineStrip } from './components/PipelineStrip.jsx';
import { VerilogViewer } from './components/VerilogViewer.jsx';
import { TruthTable } from './components/TruthTable.jsx';

export default function App() {
  // Theme: 'dark' or 'light'
  const [theme, setTheme] = useState('dark');

  // Load shared code from URL hash or default to optimizationTest preset
  const [dslCode, setDslCode] = useState(() => {
    const shared = decodeShareUrl();
    return shared || PRESET_EXAMPLES.optimizationTest;
  });

  const [activeExample, setActiveExample] = useState('optimizationTest');
  const [enableOptimization, setEnableOptimization] = useState(true);
  const [activeTab, setActiveTab] = useState('schematic'); // 'schematic', 'truthTable', 'waveform', 'verilog', 'ir', 'reverse'
  const [activeDockTab, setActiveDockTab] = useState('problems'); // 'problems', 'timemachine'
  const [selectedDiagnostic, setSelectedDiagnostic] = useState(null);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  // Resizable bottom dock (Problems / Time Machine)
  const [dockHeight, setDockHeight] = useState(320); // Comfortable default
  const [isDraggingDock, setIsDraggingDock] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(320);

  const handleDockMouseDown = (e) => {
    setIsDraggingDock(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = dockHeight;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDraggingDock) return;
    const handleMouseMove = (e) => {
      const deltaY = dragStartYRef.current - e.clientY;
      const newHeight = Math.min(680, Math.max(120, dragStartHeightRef.current + deltaY));
      setDockHeight(newHeight);
    };
    const handleMouseUp = () => {
      setIsDraggingDock(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDock]);

  // Dynamic input states (D10): derived strictly from ast.expandedInputs
  const [inputStates, setInputStates] = useState({});

  // Compilation state
  const [compilerResult, setCompilerResult] = useState(() =>
    compile(dslCode, { enableOptimization: true })
  );
  const [isCompiling, setIsCompiling] = useState(false);

  // Debounced compilation execution (Worker with sync fallback)
  const compileTimerRef = useRef(null);

  const triggerCompile = useCallback((code, optEnabled) => {
    setIsCompiling(true);
    if (compileTimerRef.current) clearTimeout(compileTimerRef.current);

    compileTimerRef.current = setTimeout(() => {
      compileAsync(code, { enableOptimization: optEnabled })
        .then((res) => {
          setCompilerResult(res);
          setIsCompiling(false);
          // Reset time-machine snapshot index to final pass
          if (res.passes && res.passes.length > 0) {
            setSnapshotIndex(res.passes.length - 1);
          }
        })
        .catch((err) => {
          console.error('Compilation failed:', err);
          setIsCompiling(false);
        });
    }, 60);
  }, []);

  useEffect(() => {
    triggerCompile(dslCode, enableOptimization);
  }, [dslCode, enableOptimization, triggerCompile]);

  // Synchronize dynamic inputStates strictly from ast.expandedInputs (D10)
  useEffect(() => {
    if (!compilerResult.ast?.expandedInputs) return;
    const currentInputs = compilerResult.ast.expandedInputs;

    setInputStates((prev) => {
      const next = {};
      let changed = false;
      currentInputs.forEach((inp) => {
        if (inp in prev) {
          next[inp] = prev[inp];
        } else {
          // Default to 1 for enable/clk signals, 0 for others
          const isHighDefault = inp.toLowerCase().includes('en') || inp === 'a';
          next[inp] = isHighDefault ? 1 : 0;
          changed = true;
        }
      });
      // Check if any old inputs were removed
      if (Object.keys(prev).length !== currentInputs.length) changed = true;
      return changed ? next : prev;
    });
  }, [compilerResult.ast?.expandedInputs]);

  // Sequential Circuit Simulator instance
  const simulator = useMemo(() => {
    const ir = enableOptimization
      ? compilerResult.optimizedIR || []
      : compilerResult.rawIR || [];
    return new CircuitSimulator(ir, compilerResult.ast);
  }, [compilerResult.optimizedIR, compilerResult.rawIR, compilerResult.ast, enableOptimization]);

  // Evaluated circuit signals
  const [computedSignals, setComputedSignals] = useState({});

  useEffect(() => {
    if (compilerResult.hasErrors) {
      setComputedSignals({}); // Clear stale UI on error (D11)
      return;
    }
    const currentSig = simulator.step(inputStates);
    setComputedSignals(currentSig);
  }, [simulator, inputStates, compilerResult.hasErrors]);

  // Toggle single input bit
  const handleToggleInput = (name) => {
    setInputStates((prev) => ({
      ...prev,
      [name]: (prev[name] ?? 0) === 1 ? 0 : 1,
    }));
  };

  // Step clock posedge
  const handleStepClock = () => {
    const clkSignal = (compilerResult.ast?.expandedInputs || []).find((i) =>
      i.toLowerCase().includes('clk')
    );
    if (clkSignal) {
      // Toggle clock low then high to create posedge
      setInputStates((prev) => {
        const cur = prev[clkSignal] ?? 0;
        return { ...prev, [clkSignal]: cur === 1 ? 0 : 1 };
      });
    } else {
      // Step generic simulation cycle
      const sigs = simulator.step(inputStates);
      setComputedSignals({ ...sigs });
    }
  };

  // Active IR and Graph for Time Machine inspection
  const activeSnapshot =
    compilerResult.passes && compilerResult.passes[snapshotIndex]
      ? compilerResult.passes[snapshotIndex]
      : null;

  const activeDisplayGraph = useMemo(() => {
    if (activeDockTab === 'timemachine' && activeSnapshot) {
      // Show graph for the selected pass snapshot
      const { buildGraphFromIR } = compile;
      return compilerResult.graph;
    }
    return compilerResult.graph || { nodes: [], edges: [] };
  }, [activeDockTab, activeSnapshot, compilerResult.graph]);

  // Truth table generator
  const truthTable = useMemo(() => {
    if (compilerResult.hasErrors || !compilerResult.ast) {
      return { inputs: [], outputs: [], rows: [], truncated: false };
    }
    const inputs = compilerResult.ast.expandedInputs || [];
    const outputs = compilerResult.ast.expandedOutputs || [];

    if (inputs.length === 0 || inputs.length > 8) {
      return { inputs, outputs, rows: [], truncated: inputs.length > 8 };
    }

    const rows = [];
    const totalComb = 1 << inputs.length;
    for (let idx = 0; idx < totalComb; idx++) {
      const currentInputs = {};
      inputs.forEach((input, inputIndex) => {
        currentInputs[input] = (idx >> (inputs.length - 1 - inputIndex)) & 1;
      });
      const sigs = simulator.step(currentInputs);
      rows.push({
        inputs: currentInputs,
        outputs: outputs.map((outp) => sigs[outp] ?? 0),
        isCurrentMatch: inputs.every(
          (input) => inputStates[input] === currentInputs[input]
        ),
      });
    }
    return { inputs, outputs, rows, truncated: false };
  }, [compilerResult, inputStates, simulator]);

  // Apply diagnostic quick-fix (D9)
  const handleApplyFix = (diagnostic) => {
    const fix = diagnostic?.fix;
    if (!fix || typeof fix.replacement !== 'string') return;

    const lines = dslCode.split('\n');
    if (fix.kind === 'insert-text') {
      const lineIdx = (fix.line || 1) - 1;
      if (lineIdx < lines.length) {
        const line = lines[lineIdx];
        const colIdx = Math.min((fix.col || line.length + 1) - 1, line.length);
        lines[lineIdx] = line.slice(0, colIdx) + fix.replacement + line.slice(colIdx);
        setDslCode(lines.join('\n'));
      }
    } else if (fix.kind === 'replace-range') {
      const lineIdx = (fix.line || 1) - 1;
      if (lineIdx < lines.length) {
        const line = lines[lineIdx];
        const start = Math.max(0, (fix.startCol || 1) - 1);
        const end = Math.min((fix.endCol || line.length + 1) - 1, line.length);
        lines[lineIdx] = line.slice(0, start) + fix.replacement + line.slice(end);
        setDslCode(lines.join('\n'));
      }
    } else if (fix.kind === 'append-line') {
      setDslCode(dslCode + '\n' + fix.replacement);
    }
    setSelectedDiagnostic(null);
  };

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden ${
        theme === 'dark' ? 'bg-[#181615] text-[#f5f5f4]' : 'bg-stone-100 text-stone-900'
      } font-sans`}
    >
      {/* Top Navigation Bar */}
      <Header
        activeExample={activeExample}
        setActiveExample={setActiveExample}
        setDslCode={setDslCode}
        enableOptimization={enableOptimization}
        setEnableOptimization={setEnableOptimization}
        compilerResult={compilerResult}
        truthTable={truthTable}
        onCompile={() => triggerCompile(dslCode, enableOptimization)}
        theme={theme}
        setTheme={setTheme}
        onOpenReverseMode={() => setActiveTab('reverse')}
      />

      {/* Main Workbench Body: Resizable 2-Column Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: CodeMirror Editor & Bottom Problems Dock */}
        <div className="w-1/2 flex flex-col border-r border-[#3b3836]">
          {/* Editor Header */}
          <div className="h-9 bg-[#201e1c] px-4 flex items-center justify-between border-b border-[#3b3836] text-xs">
            <span className="font-bold text-[#d6d3d1] flex items-center gap-1.5 font-mono">
              <Code2 size={14} className="text-amber-500" /> CircuitDSL Editor
            </span>
            <div className="flex items-center space-x-2 text-[11px] text-[#a8a29e]">
              <span>Ctrl/Cmd+Enter to compile</span>
            </div>
          </div>

          {/* CodeMirror 6 Editor Component */}
          <div className="flex-1 relative overflow-hidden">
            <CodeMirrorEditor
              dslCode={dslCode}
              setDslCode={setDslCode}
              diagnostics={compilerResult.diagnostics}
              onCompile={() => triggerCompile(dslCode, enableOptimization)}
              theme={theme}
              selectedDiagnostic={selectedDiagnostic}
            />
          </div>

          {/* Draggable Resizer Splitter */}
          <div
            onMouseDown={handleDockMouseDown}
            className="h-2 w-full bg-[#262423] hover:bg-amber-500/80 active:bg-amber-500 cursor-row-resize transition-colors flex items-center justify-center group z-10 select-none border-t border-[#3b3836]"
            title="Click and drag to resize Time Machine / Problems dock"
          >
            <div className="w-12 h-1 rounded-full bg-[#57534e] group-hover:bg-white transition-colors" />
          </div>

          {/* Bottom Dock: Problems Panel or Optimizer Time Machine */}
          <div
            style={{ height: `${dockHeight}px` }}
            className="flex flex-col bg-[#1f1d1b] overflow-hidden"
          >
            <div className="h-8 bg-[#262423] px-3 flex items-center justify-between border-b border-[#3b3836] text-xs select-none shrink-0">
              <div className="flex space-x-1 items-center">
                <button
                  onClick={() => setActiveDockTab('problems')}
                  className={`px-2.5 py-0.5 rounded font-semibold transition-colors ${
                    activeDockTab === 'problems'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'text-[#a8a29e] hover:text-white'
                  }`}
                >
                  Problems ({compilerResult.diagnostics.length})
                </button>
                <button
                  onClick={() => {
                    setActiveDockTab('timemachine');
                    if (dockHeight < 280) setDockHeight(340);
                  }}
                  className={`px-2.5 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 ${
                    activeDockTab === 'timemachine'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'text-[#a8a29e] hover:text-white'
                  }`}
                >
                  <Clock size={12} /> Time Machine ({compilerResult.passes.length})
                </button>
              </div>

              {/* Metrics Summary Chips & Height Controls */}
              <div className="flex items-center space-x-3">
                {compilerResult.metrics && (
                  <div className="flex items-center space-x-2 font-mono text-[11px] text-[#a8a29e]">
                    <span>Gates: {compilerResult.metrics.optimized.gateCount}</span>
                    <span>•</span>
                    <span>Depth: {compilerResult.metrics.optimized.logicDepth}</span>
                    {compilerResult.metrics.savings.gates > 0 && (
                      <span className="text-emerald-400 font-bold">
                        (-{compilerResult.metrics.savings.gates}%)
                      </span>
                    )}
                  </div>
                )}

                {/* Dock Height Size Buttons */}
                <div className="flex items-center space-x-1 pl-2 border-l border-[#3b3836]">
                  <button
                    onClick={() => setDockHeight(220)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      dockHeight <= 250
                        ? 'bg-[#3b3836] text-white font-bold'
                        : 'text-[#a8a29e] hover:text-white'
                    }`}
                    title="Compact view (220px)"
                  >
                    S
                  </button>
                  <button
                    onClick={() => setDockHeight(340)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      dockHeight > 250 && dockHeight <= 420
                        ? 'bg-[#3b3836] text-white font-bold'
                        : 'text-[#a8a29e] hover:text-white'
                    }`}
                    title="Standard view (340px)"
                  >
                    M
                  </button>
                  <button
                    onClick={() => setDockHeight(500)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      dockHeight > 420
                        ? 'bg-[#3b3836] text-white font-bold'
                        : 'text-[#a8a29e] hover:text-white'
                    }`}
                    title="Enlarged view (500px)"
                  >
                    L
                  </button>
                  <button
                    onClick={() => setDockHeight((prev) => (prev > 260 ? 140 : 420))}
                    className="p-1 text-[#a8a29e] hover:text-white hover:bg-[#3b3836] rounded transition-colors"
                    title={dockHeight > 260 ? 'Collapse dock' : 'Expand dock'}
                  >
                    {dockHeight > 260 ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {activeDockTab === 'problems' ? (
                <DiagnosticsPanel
                  diagnostics={compilerResult.diagnostics}
                  onSelectDiagnostic={setSelectedDiagnostic}
                  onApplyFix={handleApplyFix}
                />
              ) : (
                <OptimizerTimeMachine
                  passes={compilerResult.passes}
                  activeSnapshotIndex={snapshotIndex}
                  onSelectSnapshot={setSnapshotIndex}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Multi-Tab Workbench */}
        <div className="w-1/2 flex flex-col bg-[#181615]">
          {/* Right Tab Bar */}
          <div className="h-9 bg-[#201e1c] px-3 flex items-center justify-between border-b border-[#3b3836] text-xs">
            <div className="flex space-x-1 bg-[#181615] p-0.5 rounded-lg border border-[#44403c]">
              <button
                onClick={() => setActiveTab('schematic')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'schematic'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
              >
                <Layers size={13} /> Schematic
              </button>
              <button
                onClick={() => setActiveTab('truthTable')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'truthTable'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
              >
                <Table size={13} /> Truth Table
              </button>
              <button
                onClick={() => setActiveTab('waveform')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'waveform'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
              >
                <Radio size={13} /> Waveform
              </button>
              <button
                onClick={() => setActiveTab('verilog')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'verilog'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
              >
                <FileCode size={13} /> Verilog
              </button>
              <button
                onClick={() => setActiveTab('ir')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'ir'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
              >
                <Binary size={13} /> IR / Passes
              </button>
              <button
                onClick={() => setActiveTab('reverse')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1 ${
                  activeTab === 'reverse'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-[#a8a29e] hover:text-white'
                }`}
              >
                <Wand2 size={13} /> Reverse Mode
              </button>
            </div>
          </div>

          {/* Right Tab Content View */}
          <div className="flex-1 relative overflow-hidden">
            {activeTab === 'schematic' && (
              <SchematicView
                graph={activeDisplayGraph}
                signals={computedSignals}
                onToggleInput={handleToggleInput}
                activeChange={activeSnapshot?.changes?.[0]}
                selectedSignal={selectedSignal}
                onSelectSignal={setSelectedSignal}
              />
            )}

            {activeTab === 'truthTable' && (
              <TruthTable truthTable={truthTable} />
            )}

            {activeTab === 'waveform' && (
              <WaveformViewer
                simulator={simulator}
                inputs={inputStates}
                onToggleInput={handleToggleInput}
                onStepClock={handleStepClock}
                onResetSimulator={() => simulator.reset()}
              />
            )}

            {activeTab === 'verilog' && (
              <VerilogViewer
                verilog={compilerResult.verilog}
                testbench={compilerResult.testbench}
                circuitName={compilerResult.ast?.circuitName || 'Circuit'}
              />
            )}

            {activeTab === 'ir' && (
              <div className="p-4 h-full overflow-auto font-mono text-xs text-[#d6d3d1] select-text">
                <div className="mb-4">
                  <h3 className="font-bold text-amber-400 mb-1">Raw SSA Intermediate Representation (IR):</h3>
                  <pre className="bg-[#1e1c1a] p-3 rounded-lg border border-[#3b3836]">
                    {JSON.stringify(compilerResult.rawIR, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="font-bold text-emerald-400 mb-1">Optimized IR:</h3>
                  <pre className="bg-[#1e1c1a] p-3 rounded-lg border border-[#3b3836]">
                    {JSON.stringify(compilerResult.optimizedIR, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'reverse' && (
              <ReverseModeModal
                onSendToEditor={(minimizedDsl) => {
                  setDslCode(minimizedDsl);
                  setActiveTab('schematic');
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Pipeline Status Strip with Timing Profiler */}
      <PipelineStrip
        timings={compilerResult.timings}
        diagnostics={compilerResult.diagnostics}
        hasErrors={compilerResult.hasErrors}
      />
    </div>
  );
}
