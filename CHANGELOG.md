# Changelog

All notable changes to the CircuitDSL Compiler Workbench project are documented in this file.

## [2.0.0] - 2026-10-31

### Added
- **Single-Entry Compiler API:** `compile(source, options)` in `src/compiler/index.js` returning full compilation bundles.
- **Web Worker Execution:** Background compiler worker (`compiler.worker.js` and `compilerClient.js`) with debouncing and synchronous fallback.
- **Formal Equivalence Checker:** Exhaustive Boolean verification ($\le 16$ inputs) and structured corner-case/random-sat check ($> 16$ inputs) with counterexample generation and "Verified Equivalent" badge.
- **Optimizer Time Machine (N1):** Per-pass immutable snapshot recording, stepper/slider controls, play/pause animation, and visual gate highlighting for eliminated (red), merged (amber), and rewritten (blue) gates.
- **Reverse Mode (N2):** Interactive truth table editor with 0, 1, X don't-care toggles, Quine-McCluskey minimization, essential prime implicant extraction, Gray-code ordered K-Maps (2x2, 2x4, 4x4), and "Send to Editor" feature.
- **Waveform Viewer (N3):** Sequential timing diagram with clock stepping (`posedge`), auto-run clock, signal history scrubbing, and dynamic input toggles.
- **Signal Tracing (N4):** Click-to-inspect on schematic canvas highlighting full fan-in and fan-out dependency cones.
- **Automated Verilog Testbench Generator (N5):** Generates self-checking IEEE 1364 testbenches with clock generators and verification checks.
- **Share & Multi-Format Export (N6):** `lz-string` URL hash compression, export to `.v`, `_tb.v`, `.json`, `.csv`, and `.svg`.
- **Examples Library (N7):** 15 verified digital logic circuits with descriptions (Adders, Multiplexers, ALU, Decoders, Comparators, Counters, DFF, Parity, etc.).
- **CodeMirror 6 Editor:** Replaced textarea overlay with CodeMirror 6, custom CircuitDSL syntax highlighter, live lint squiggles, autocomplete, hover tooltips, and quick-fixes.
- **Dagre Layered Schematic:** Replaced naive grid with layered layout, SVG gate symbols, orthogonal routing, pan/zoom, and minimap.
- **Comprehensive Test Suite:** 54 automated tests across unit stages (V1), defects reproduction (V2), fast-check property-based tests (V3), and golden examples (V4) achieving **88.14%** statement coverage on `src/compiler`.
- **GitHub Actions CI:** Complete automated workflow running lint, test, coverage, iverilog verification, and production build.
- **MIT License:** Added `LICENSE` with copyright to V. Jaya Adithya.

### Fixed
- **D1 (DCE on User Wires):** Fixed DCE to strictly treat primary outputs and sequential state as active roots; user-declared dead wires (e.g. `dead_wire`) are now correctly eliminated.
- **D2 (Copy Propagation):** Implemented transitive copy propagation through `BUF` alias chains, allowing the README `OptimizationDemo` to correctly reduce from 5 logic gates to 2 logic gates (60% reduction).
- **D3 (Missing Rewrites & Fixed-Point):** Implemented complete n-ary algebraic rewrites for `AND`, `OR`, `XOR`, `NOT`, `NAND`, `NOR`, `XNOR`, constant folding, and absorption.
- **D4 (Verilog Standards Compliance):** Replaced non-standard `~&` and `~|` with proper bitwise expressions `~(a & b)`, formatted sized constants `1'b0`/`1'b1`, eliminated illegal bus wire declarations `wire w[0];`, and emitted clocked `always @(posedge clk)` blocks for flip-flops.
- **D5 (Sequential DFF Semantics):** Implemented real stateful flip-flop simulation triggered on clock positive edges with reset support.
- **D6 (Combinational Loop Detection):** Implemented DFS dependency cycle detection reporting exact loop paths (`E_COMBINATIONAL_LOOP`) and single-pass topological evaluation for acyclic circuits.
- **D7 (Arity & Type Checking):** Added gate signature registry, bus bounds checking (`E_BUS_INDEX_OUT_OF_BOUNDS`), single-diagnostic typo suggestions (`"Unknown gate 'ADN'. Did you mean 'AND'?"`), and non-binary literal detection.
- **D8 (Accurate Source Locations):** Preserved start and end line/column coordinates `{ startLine, startCol, endLine, endCol }` on all tokens, AST nodes, and diagnostics.
- **D9 (Consolidated Diagnostic Pipeline):** Consolidated regex scanner and AST checks into a unified pipeline with error recovery and block comment `/* ... */` support.
- **D10 (Dynamic UI Inputs):** Derived simulation input state dynamically from `ast.expandedInputs`, eliminating hardcoded signal maps.
- **D11 (Grammar & State Hygiene):** Deduplicated keyword definitions, made `: Wire` optional in declarations, and cleared stale simulation displays on compilation errors.

### Changed
- Replaced broken Jest / Babel configuration with Vitest v2 and `@vitest/coverage-v8`.
- Replaced legacy ESLint config with ESLint 9 flat configuration (`eslint.config.js`).
- Normalized CRLF line endings to LF with `.gitattributes` and Prettier formatting.
