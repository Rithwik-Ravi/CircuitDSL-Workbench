# Architectural & Design Decisions

This document records architectural, design, and implementation decisions made during the CircuitDSL Compiler Workbench v2 modernization.

## Decision 1: Test Runner & Tooling Migration (Phase 0)
- **Decision:** Replace broken Jest configuration with Vitest v2 (`^2.1.8`) and `@vitest/coverage-v8`, and configure ESLint 9 flat config (`eslint.config.js`) + Prettier.
- **Rationale:** The repository is configured as an ES Module (`"type": "module"`). Jest without Babel/transform pipeline failed on ESM imports. Vitest runs natively with Vite's module resolution, executes tests in milliseconds, and integrates directly with Vite build pipeline.
- **Outcome:** Clean `npm run test`, `npm run coverage`, `npm run lint`, and `npm run format`.

## Decision 2: IR Architecture & Pass Pipeline (D1, D2, D3)
- **Decision:** Rebuild `OptimizationEngine` as an extensible fixed-point multi-pass pipeline. Each pass takes `IR` and produces `{ ir, changes[] }`, preserving per-pass snapshots for the Optimizer Time Machine.
- **Root Set for DCE:** Dead Code Elimination roots are strictly primary circuit outputs (and registered state elements such as DFFs). Internal user-declared wires that do not contribute to primary outputs or sequential state are dead and will be eliminated.
- **Alias / Copy Propagation:** BUF instructions (`x = BUF(y)`) are treated as alias bindings. Before CSE and rewrite rules, transitive copy propagation replaces uses of `x` with `y`. Redundant BUF copies to dead intermediates are removed.
- **Pass Structure:**
  1. Copy Propagation
  2. Common Subexpression Elimination (CSE)
  3. Algebraic Rewrites & Constant Folding (n-ary, idempotent, identity, nulling, absorption, negation)
  4. Dead Code Elimination (DCE)

## Decision 3: Verilog Generation Standard Compliance (D4, D5)
- **Decision:** Generate IEEE 1364-2005 compliant Verilog.
- **Operators:** Replace illegal operators `~&` and `~|` with proper bitwise expressions `~(a & b)`, `~(a | b)`, and `~(a ^ b)` for XNOR.
- **Buses:** Vector declarations for buses (`wire [3:0] a;`) or properly indexed names (`a[0]`), avoiding illegal syntax like `wire w[0];`.
- **Constants:** Format constants with width and radix (`1'b0`, `1'b1`).
- **Sequential Logic (DFF):** Emit dedicated `reg` signals inside `always @(posedge clk or posedge reset)` or synchronous reset blocks with non-blocking assignments (`<=`).

## Decision 4: Dependency Graph & Topological Evaluation (D6)
- **Decision:** Replace the iterative relaxation evaluator with a directed dependency graph. Detect combinational cycles using Tarjan's or Kosaraju's SCC algorithm / DFS cycle detection, excluding sequential DFF boundaries.
- **Outcome:** Combinational loops are detected statically with the exact cycle path reported as a compile diagnostic; acyclic circuits are evaluated in a single topological pass.

## Decision 5: Unified Diagnostic Pipeline (D7, D8, D9)
- **Decision:** Deprecate and replace the fragile regex scanner in `diagnostics.js` with a unified compiler diagnostic pipeline originating from `Lexer`, `ASTParser`, and `SemanticAnalyzer`.
- **Diagnostics Format:** `{ code, severity: 'error'|'warning'|'info', range: { startLine, startCol, endLine, endCol }, message, explanation, suggestion, fix?: { type, text, range } }`.
- **Error Recovery:** Implement panic-mode recovery in `ASTParser` synchronizing on `;` and `}` delimiters. Support C-style block comments `/* ... */`.

## Decision 6: Single-Entry Compiler API & Web Worker (Phase 1)
- **Decision:** Expose a single pure entry point `compile(source, options)` in `src/compiler/index.js` returning `{ tokens, ast, diagnostics, ir, optimized, passes, metrics, verilog, testbench, graph, equivalent }`.
- **Execution:** Execute in a background Web Worker (`compiler.worker.js`) via `compilerClient.js` with automatic fallback to synchronous execution for non-worker environments or unit tests.

## Decision 7: Equivalence Verification Strategy (Phase 1)
- **Decision:** Implement exhaustive verification for circuits with $\le 16$ inputs ($2^{16} = 65,536$ vectors max). For circuits $> 16$ inputs, verify across structured corner-case vectors (all 0s, all 1s, walking 1s, walking 0s) and random simulation vectors up to 2,048 samples.
- **Counterexample Reporting:** On any output mismatch, immediately return `{ equivalent: false, counterexample: { inputs, failingOutput, expected, actual } }`.

## Decision 8: Optimizer Time Machine Architecture (Phase 2 N1)
- **Decision:** The optimizer preserves an immutable snapshot array of `{ passName, ir, changes: [{ pass, before, after, reason, target }] }` across all iterations. The UI provides a step slider, play/pause controls, and gate color-coding (red for eliminated, amber for merged CSE, blue for rewritten).

## Decision 9: Reverse Mode Architecture (Phase 2 N2)
- **Decision:** Implement exact Quine-McCluskey minimization with essential prime implicant extraction and Petrick-style greedy covering. For $\le 4$ variables, generate Gray-code ordered Karnaugh Maps (2x2, 2x4, 4x4) with interactive cell editing (0, 1, X don't-care) and one-click "Send to Editor".

## Decision 10: Modernized IDE Workbench UI (Phase 3)
- **Decision:** Replace the previous textarea-overlay editor with CodeMirror 6 featuring custom syntax highlighting, live lint squiggles, hover tooltips, and autocomplete. Replace the fixed grid schematic canvas with Dagre-based layered layout, SVG gate symbols, orthogonal wire routing, pan/zoom, interactive input toggling, and signal cone tracing.
