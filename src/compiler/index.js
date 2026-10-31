import { Lexer } from './Lexer.js';
import { ASTParser } from './ASTParser.js';
import { SemanticAnalyzer } from './SemanticAnalyzer.js';
import { IRBuilder } from './IRBuilder.js';
import { OptimizationEngine } from './OptimizationEngine.js';
import { evaluateCircuitIR, buildGraphFromIR, CircuitSimulator } from './Evaluator.js';
import { generateVerilog, generateTestbench } from './VerilogGenerator.js';
import { analyzeSourceDiagnostics, enrichDiagnostics } from './diagnostics.js';
import { computeCircuitMetrics } from './metrics.js';
import { checkEquivalence } from './equivalenceChecker.js';
import { mapToNandOnly, mapToNorOnly } from './technologyMapper.js';
import { QuineMcCluskey } from './quineMcCluskey.js';

export {
  Lexer,
  ASTParser,
  SemanticAnalyzer,
  IRBuilder,
  OptimizationEngine,
  evaluateCircuitIR,
  buildGraphFromIR,
  CircuitSimulator,
  generateVerilog,
  generateTestbench,
  analyzeSourceDiagnostics,
  enrichDiagnostics,
  computeCircuitMetrics,
  checkEquivalence,
  mapToNandOnly,
  mapToNorOnly,
  QuineMcCluskey,
};

export function compile(source, options = {}) {
  const enableOptimization = options.enableOptimization ?? true;
  const startTime = performance.now();

  const timings = {
    lex: 0,
    parse: 0,
    sema: 0,
    ir: 0,
    opt: 0,
    gen: 0,
    equiv: 0,
    total: 0,
  };

  // 1. Lexical Analysis
  const t0 = performance.now();
  const lexer = new Lexer(source);
  const lexResult = lexer.tokenize();
  timings.lex = Math.round((performance.now() - t0) * 100) / 100;

  // 2. Syntax Analysis (AST Construction)
  const t1 = performance.now();
  const parser = new ASTParser(lexResult.tokens);
  const parseResult = parser.parse();
  timings.parse = Math.round((performance.now() - t1) * 100) / 100;

  // 3. Semantic Analysis
  const t2 = performance.now();
  const semaDiagnostics = parseResult.ast
    ? SemanticAnalyzer.analyze(parseResult.ast)
    : [];
  timings.sema = Math.round((performance.now() - t2) * 100) / 100;

  // 4. Fallback Source Diagnostics
  const sourceFallbackDiagnostics =
    parseResult.diagnostics.length > 0
      ? analyzeSourceDiagnostics(source)
      : [];

  const rawDiagnostics = [
    ...lexResult.errors,
    ...parseResult.diagnostics,
    ...semaDiagnostics,
    ...sourceFallbackDiagnostics,
  ];

  // Deduplicate diagnostics by code + line + message
  const seenDiagKeys = new Set();
  const dedupedDiagnostics = rawDiagnostics.filter((d) => {
    const key = `${d.code || d.message}:${d.line}:${d.col}`;
    if (seenDiagKeys.has(key)) return false;
    seenDiagKeys.add(key);
    return true;
  });

  const diagnostics = enrichDiagnostics(dedupedDiagnostics, source);
  const hasErrors = diagnostics.some((d) => d.severity === 'error' || d.type === 'error');

  let rawIR = [];
  let optimizedIR = [];
  let optResult = null;
  let activeIR = [];
  let graph = { nodes: [], edges: [] };
  let verilog = '// Fix compiler errors to generate Verilog.';
  let testbench = '';
  let metrics = null;
  let equivalence = null;

  if (!hasErrors && parseResult.ast) {
    // 5. IR Construction
    const t3 = performance.now();
    rawIR = IRBuilder.buildIR(parseResult.ast);
    timings.ir = Math.round((performance.now() - t3) * 100) / 100;

    // 6. Optimization Passes
    const t4 = performance.now();
    optResult = OptimizationEngine.optimize(rawIR, parseResult.ast);
    optimizedIR = optResult.optimizedIR;
    activeIR = enableOptimization ? optimizedIR : rawIR;
    timings.opt = Math.round((performance.now() - t4) * 100) / 100;

    // 7. Codegen & Graph
    const t5 = performance.now();
    graph = buildGraphFromIR(activeIR, parseResult.ast);
    verilog = generateVerilog(parseResult.ast, activeIR);
    testbench = generateTestbench(parseResult.ast, activeIR);
    metrics = computeCircuitMetrics(rawIR, optimizedIR, parseResult.ast);
    timings.gen = Math.round((performance.now() - t5) * 100) / 100;

    // 8. Equivalence Verification
    const t6 = performance.now();
    equivalence = checkEquivalence(rawIR, optimizedIR, parseResult.ast);
    timings.equiv = Math.round((performance.now() - t6) * 100) / 100;
  }

  timings.total = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    tokens: lexResult.tokens,
    ast: parseResult.ast,
    diagnostics,
    hasErrors,
    ir: rawIR,
    rawIR,
    optimizedIR,
    activeIR,
    passes: optResult?.passSnapshots || [],
    stats: optResult?.stats || {},
    metrics,
    equivalence,
    verilog,
    testbench,
    graph,
    timings,
  };
}
