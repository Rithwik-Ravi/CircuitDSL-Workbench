import React, { useMemo, useState } from 'react';
import { Maximize2, Scissors, Table, ZoomIn, ZoomOut } from 'lucide-react';
import { ASTParser } from './compiler/ASTParser.js';
import {
  analyzeSourceDiagnostics,
  enrichDiagnostics,
} from './compiler/diagnostics.js';
import { evaluateCircuitIR, buildGraphFromIR } from './compiler/Evaluator.js';
import { IRBuilder } from './compiler/IRBuilder.js';
import { Lexer } from './compiler/Lexer.js';
import { OptimizationEngine } from './compiler/OptimizationEngine.js';
import { SemanticAnalyzer } from './compiler/SemanticAnalyzer.js';
import { generateVerilog } from './compiler/VerilogGenerator.js';
import { CodeEditor } from './components/CodeEditor.jsx';
import { DiagnosticsPanel } from './components/DiagnosticsPanel.jsx';
import { Header } from './components/Header.jsx';
import { OptimizationReport } from './components/OptimizationReport.jsx';
import { SchematicCanvas } from './components/SchematicCanvas.jsx';
import { SimulationDrawer } from './components/SimulationDrawer.jsx';
import { TokenTable } from './components/TokenTable.jsx';
import { TruthTable } from './components/TruthTable.jsx';
import { PRESET_EXAMPLES } from './utils/presets.js';
function isApplicableFix(fix) {
  if (!fix || typeof fix.replacement !== 'string') return false;
  if (fix.kind === 'replace-line') {
    return Number.isInteger(fix.line) && fix.line > 0;
  }
  if (fix.kind === 'append-line') return true;
  return (
    fix.kind === 'replace-range' &&
    Number.isInteger(fix.line) &&
    fix.line > 0 &&
    Number.isInteger(fix.startCol) &&
    fix.startCol > 0 &&
    Number.isInteger(fix.endCol) &&
    fix.endCol >= fix.startCol
  );
}
export default function App() {
  const [dslCode, setDslCode] = useState(PRESET_EXAMPLES.optimizationTest);
  const [activeTab, setActiveTab] = useState('schematic');
  const [selectedDiagnostic, setSelectedDiagnostic] = useState(null);
  const [activeExample, setActiveExample] = useState('optimizationTest');
  const [enableOptimization, setEnableOptimization] = useState(true);
  const [lineWrap, setLineWrap] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [inputStates, setInputStates] = useState({
    a: 1,
    b: 1,
    enable: 1,
    in_a: 1,
    in_b: 1,
    in0: 1,
    in1: 0,
    sel: 1,
    op: 0,
    d: 1,
    reset: 0,
    cin: 0,
    'a[0]': 1,
    'a[1]': 0,
    'a[2]': 1,
    'a[3]': 0,
    'b[0]': 1,
    'b[1]': 1,
    'b[2]': 0,
    'b[3]': 0,
  });
  const compilerResult = useMemo(() => {
    const lexer = new Lexer(dslCode);
    const lexResult = lexer.tokenize();
    const parser = new ASTParser(lexResult.tokens);
    const parseResult = parser.parse();
    const semanticDiagnostics = SemanticAnalyzer.analyze(parseResult.ast);
    const sourceDiagnostics = analyzeSourceDiagnostics(dslCode);
    const diagnostics = enrichDiagnostics(
      [
        ...lexResult.errors,
        ...parseResult.diagnostics,
        ...semanticDiagnostics,
        ...sourceDiagnostics,
      ],
      dslCode
    );
    let rawIR = [];
    let optimizedIR = [];
    let optStats = {};
    let activeIR = [];
    let graph = { nodes: [], edges: [] };
    let verilog = '// Fix compiler errors to generate Verilog.';
    if (
      !diagnostics.some((diagnostic) => diagnostic.type === 'error') &&
      parseResult.ast
    ) {
      try {
        rawIR = IRBuilder.buildIR(parseResult.ast);
        const optimized = OptimizationEngine.optimize(rawIR, parseResult.ast);
        optimizedIR = optimized.optimizedIR;
        optStats = optimized.stats;
        activeIR = enableOptimization ? optimizedIR : rawIR;
        graph = buildGraphFromIR(activeIR, parseResult.ast);
        verilog = generateVerilog(parseResult.ast, activeIR);
      } catch (error) {
        rawIR = [];
        optimizedIR = [];
        activeIR = [];
        optStats = {};
        graph = { nodes: [], edges: [] };
        diagnostics.push({
          type: 'error',
          line: 1,
          col: 1,
          message: `Compiler Error: ${error instanceof Error ? error.message : String(error)}`,
          explanation: 'The compiler could not process this program.',
          suggestion: 'Check the source syntax and signal declarations.',
        });
      }
    }
    return {
      tokens: lexResult.tokens,
      ast: parseResult.ast,
      diagnostics,
      rawIR,
      optimizedIR,
      activeIR,
      optStats,
      graph,
      verilog,
      hasErrors: diagnostics.some((diagnostic) => diagnostic.type === 'error'),
    };
  }, [dslCode, enableOptimization]);
  const computedSignals = useMemo(() => {
    if (compilerResult.hasErrors) return inputStates;
    return evaluateCircuitIR(compilerResult.activeIR, inputStates);
  }, [inputStates, compilerResult]);
  const truthTable = useMemo(() => {
    if (compilerResult.hasErrors || !compilerResult.ast) {
      return { headers: [], rows: [] };
    }
    const inputs = compilerResult.ast.expandedInputs;
    const outputs = compilerResult.ast.expandedOutputs;
    if (inputs.length === 0 || inputs.length > 8) {
      return { headers: [], rows: [], truncated: true };
    }
    const rows = [];
    for (let index = 0; index < 1 << inputs.length; index++) {
      const currentInputs = {};
      inputs.forEach((input, inputIndex) => {
        currentInputs[input] = (index >> (inputs.length - 1 - inputIndex)) & 1;
      });
      const signals = evaluateCircuitIR(compilerResult.activeIR, currentInputs);
      rows.push({
        inputs: currentInputs,
        outputs: outputs.map((output) => signals[output] ?? 0),
        isCurrentMatch: inputs.every(
          (input) => inputStates[input] === currentInputs[input]
        ),
      });
    }
    return { inputs, outputs, rows, truncated: false };
  }, [compilerResult, inputStates]);
  const toggleInputSignal = (name) => {
    setInputStates((previous) => ({
      ...previous,
      [name]: previous[name] ? 0 : 1,
    }));
  };
  const handleMouseDown = (event) => {
    setIsDragging(true);
    setDragStart({
      x: event.clientX - panOffset.x,
      y: event.clientY - panOffset.y,
    });
  };
  const handleMouseMove = (event) => {
    if (!isDragging) return;
    setPanOffset({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    });
  };
  const handleMouseUp = () => setIsDragging(false);
  const applySuggestedFix = (diagnostic) => {
    const fix = diagnostic.fix;
    if (!isApplicableFix(fix)) return;
    const lines = dslCode.split('\n');
    if (fix.kind === 'append-line') {
      const separator =
        dslCode.endsWith('\n') || dslCode.length === 0 ? '' : '\n';
      setDslCode(`${dslCode}${separator}${fix.replacement}`);
    } else if (fix.kind === 'replace-line' && fix.line <= lines.length) {
      lines[fix.line - 1] = fix.replacement;
      setDslCode(lines.join('\n'));
    } else if (fix.kind === 'replace-range' && fix.line <= lines.length) {
      const line = lines[fix.line - 1];
      lines[fix.line - 1] =
        line.slice(0, fix.startCol - 1) +
        fix.replacement +
        line.slice(fix.endCol - 1);
      setDslCode(lines.join('\n'));
    }
    setSelectedDiagnostic(null);
  };
  return (
    <div className="flex flex-col h-screen bg-[#1c1917] text-[#f5f5f4] font-sans antialiased overflow-hidden select-none">
      <Header
        activeExample={activeExample}
        setActiveExample={setActiveExample}
        setDslCode={setDslCode}
        enableOptimization={enableOptimization}
        setEnableOptimization={setEnableOptimization}
        compilerResult={compilerResult}
        truthTable={truthTable}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col border-r border-[#44403c]">
          <CodeEditor
            dslCode={dslCode}
            setDslCode={setDslCode}
            lineWrap={lineWrap}
            setLineWrap={setLineWrap}
            diagnostics={compilerResult.diagnostics}
            onDiagnosticSelect={setSelectedDiagnostic}
            selectedDiagnostic={selectedDiagnostic}
          />
          <DiagnosticsPanel
            diagnostics={compilerResult.diagnostics}
            onSelectDiagnostic={setSelectedDiagnostic}
            onApplyFix={applySuggestedFix}
          />
        </div>
        <div className="w-1/2 flex flex-col bg-[#1c1917]">
          <div className="h-10 bg-[#292524]/80 px-4 flex items-center justify-between border-b border-[#44403c]">
            <div className="flex space-x-1 bg-[#1c1917] p-1 rounded-xl border border-[#44403c]">
              <button
                onClick={() => setActiveTab('schematic')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'schematic'
                    ? 'bg-[#c25e00] text-slate-950 shadow'
                    : 'text-[#a8a29e]'
                }`}
              >
                Schematic
              </button>
              <button
                onClick={() => setActiveTab('tokens')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  activeTab === 'tokens'
                    ? 'bg-[#c25e00] text-slate-950 shadow'
                    : 'text-[#a8a29e]'
                }`}
              >
                <Table className="w-3 h-3" /> Tokens
              </button>
              <button
                onClick={() => setActiveTab('verilog')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'verilog'
                    ? 'bg-[#c25e00] text-slate-950 shadow'
                    : 'text-[#a8a29e]'
                }`}
              >
                Verilog
              </button>
              <button
                onClick={() => setActiveTab('truthtable')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  activeTab === 'truthtable'
                    ? 'bg-[#c25e00] text-slate-950 shadow'
                    : 'text-[#a8a29e]'
                }`}
              >
                <Table className="w-3 h-3" /> Truth Table
              </button>
              <button
                onClick={() => setActiveTab('optimizations')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  activeTab === 'optimizations'
                    ? 'bg-[#c25e00] text-slate-950 shadow'
                    : 'text-[#a8a29e]'
                }`}
              >
                <Scissors className="w-3 h-3" /> IR &amp; Optimizer
              </button>
            </div>
            {activeTab === 'schematic' && (
              <div className="flex items-center space-x-1 bg-[#1c1917] p-0.5 rounded-lg border border-[#44403c]">
                <button
                  onClick={() =>
                    setZoomLevel((level) => Math.min(level + 0.1, 2))
                  }
                  className="p-1 text-[#a8a29e]"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    setZoomLevel((level) => Math.max(level - 0.1, 0.4))
                  }
                  className="p-1 text-[#a8a29e]"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-1 text-[#a8a29e]"
                  title="Fit to Screen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          {activeTab === 'schematic' && (
            <SchematicCanvas
              graph={compilerResult.graph}
              computedSignals={computedSignals}
              zoomLevel={zoomLevel}
              panOffset={panOffset}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
            />
          )}
          {activeTab === 'tokens' && (
            <TokenTable tokens={compilerResult.tokens} />
          )}
          {activeTab === 'verilog' && (
            <div className="flex-1 p-4 bg-[#1c1917] overflow-auto font-mono text-xs">
              <div className="bg-[#292524] rounded-2xl p-4 border border-[#44403c] text-[#fefae0]">
                <pre className="whitespace-pre-wrap leading-5">
                  {compilerResult.verilog}
                </pre>
              </div>
            </div>
          )}
          {activeTab === 'truthtable' && <TruthTable truthTable={truthTable} />}
          {activeTab === 'optimizations' && (
            <OptimizationReport optStats={compilerResult.optStats} />
          )}
        </div>
      </div>
      <SimulationDrawer
        expandedInputs={compilerResult.ast?.expandedInputs}
        inputStates={inputStates}
        toggleInputSignal={toggleInputSignal}
      />
    </div>
  );
}
