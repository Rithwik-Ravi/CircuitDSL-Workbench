# CircuitDSL Compiler & Visualization Workbench v2

[![CI](https://github.com/Jayaadithya-cody/Circuit-DSL/actions/workflows/ci.yml/badge.svg)](https://github.com/Jayaadithya-cody/Circuit-DSL/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Coverage](https://img.shields.io/badge/Coverage-88.1%25-emerald.svg)](VALIDATION.md)
[![Tests](https://img.shields.io/badge/Tests-54%20passed-blue.svg)](VALIDATION.md)

A modern, high-performance browser compiler workbench for a hardware Domain-Specific Language (CircuitDSL). Built with **React 18 + Vite 5 + CodeMirror 6 + Tailwind CSS**, featuring an optimizing SSA-based compiler pipeline, formal equivalence checking, interactive schematic visualization, an Optimizer Time Machine, digital waveform simulation, and a Quine-McCluskey reverse synthesis mode.

---

## Highlights & Features

- **CodeMirror 6 Editor:** Real-time CircuitDSL syntax highlighting, diagnostic squiggles, hover tooltips with explanations, autocomplete for gates and declared signals, and one-click quick-fixes.
- **SSA Multi-Pass Optimizer:** Fixed-point pass pipeline executing Copy/Alias Propagation, Common Subexpression Elimination (CSE), n-ary Algebraic Rewriting, Constant Folding, and Output-Rooted Dead Code Elimination (DCE).
- **Optimizer Time Machine (Headline UX):** Step or scrub through every optimization pass. Visual highlights for eliminated gates (red), merged gates (amber), and rewritten expressions (blue) alongside compiler transformation logs.
- **Formal Equivalence Checker:** Mathematical proof verifying that optimized IR matches the original circuit across all input vectors ($\le 16$ inputs exhaustive; $> 16$ inputs structured random-sat), showing counterexample vectors on any discrepancy with a "Verified Equivalent" badge.
- **Dagre Layered Schematic Canvas:** Layered layout with realistic digital logic gate symbols (AND, OR, XOR, NOT, NAND, NOR, XNOR, BUF, DFF), orthogonal wire routing, pan/zoom, interactive clickable pin toggles, and minimap.
- **Signal Tracing Cone Inspector:** Click any wire or gate to highlight its full upstream fan-in cone and downstream fan-out cone.
- **Digital Waveform Viewer:** Multi-signal timing diagram for sequential circuits (DFF), supporting manual clock stepping, automated clock execution, and history scrubbing.
- **Reverse Mode (Truth Table to Circuit):** Editable truth table with $0, 1, X$ (don't-care) states $\rightarrow$ live Quine-McCluskey minimization $\rightarrow$ Gray-code ordered Karnaugh Maps (2 to 4 variables) $\rightarrow$ minimal sum-of-products (SOP) DSL and Verilog generation with one-click "Send to Editor".
- **Standard Verilog & Testbench Codegen:** Generates valid IEEE 1364-2005 compliant Verilog modules and self-checking testbenches with clock generators and verification routines.
- **Technology Remapping:** Optional synthesis passes to re-target circuits into universal **NAND-only** or **NOR-only** standard cell libraries.
- **Share & Export:** Program compression via `lz-string` into URL hashes, plus exports for `.v`, `_tb.v`, `.json`, `.csv`, and `.svg`.
- **Verified Examples Library:** 15 pre-built digital circuits including Half/Full Adders, 4-Bit Ripple Adders, Multiplexers (2:1, 4:1), 2:4 Decoders, 4-Bit Parity Generators, 2-Bit Magnitude Comparators, D Flip-Flops, 3-Bit Synchronous Counters, and ALU Slices.

---

## Compiler Pipeline Architecture

```text
Source Code
    │
    ▼
[ Lexer ] ────────────► Token Stream with Exact Source Spans
    │
    ▼
[ ASTParser ] ────────► Abstract Syntax Tree (AST) + Panic-Mode Error Recovery
    │
    ▼
[ SemanticAnalyzer ] ─► Arity Verification, Gate Typo Suggestions, Bus Bounds, Loop Detection
    │
    ▼
[ IRBuilder ] ────────► 3-Address SSA Intermediate Representation
    │
    ▼
[ OptimizationEngine ]
  ├── Pass 1: Copy / Alias Propagation (Transitive BUF Resolution)
  ├── Pass 2: Common Subexpression Elimination (CSE)
  ├── Pass 3: N-ary Algebraic Rewrites & Constant Folding
  └── Pass 4: Dead Code Elimination (Primary Output & DFF Roots)
    │
    ├───► [ EquivalenceChecker ] ──► Exhaustive / SAT Formal Proof
    ├───► [ VerilogGenerator ]   ──► IEEE 1364-2005 Module + Self-Checking Testbench
    ├───► [ Dagre Layout ]       ──► Schematic Graph & Signal Flow
    └───► [ CircuitSimulator ]   ──► Multi-Cycle Digital Waveforms
```

---

## Example: The Optimization Demo

```text
// Circuit with Dead Code, CSE, and Redundant Gates
circuit OptimizationDemo {
    input a: Wire;
    input b: Wire;
    input enable: Wire;
    output out_final: Wire;

    wire dead_wire: Wire;
    wire cse_1: Wire;
    wire cse_2: Wire;
    wire const_wire: Wire;

    // 1. Dead Code: Unused wire and gate
    dead_wire = XOR(a, b);

    // 2. Common Subexpression Elimination (CSE)
    cse_1 = AND(a, b);
    cse_2 = AND(a, b);

    // 3. Constant Folding & Redundancy Simplification (OR(x, x) -> x)
    const_wire = OR(cse_1, cse_2);

    // Primary output
    out_final = AND(const_wire, enable);
}
```

### Compiler Optimization Execution:
1. **CSE:** Identifies `cse_1` and `cse_2` as identical duplicates of `AND(a, b)`, merging `cse_2` into `cse_1`.
2. **Copy Propagation:** Replaces `OR(cse_1, cse_2)` with `OR(cse_1, cse_1)`.
3. **Algebraic Rewriting:** Simplifies idempotent `OR(x, x)` to `x`.
4. **Dead Code Elimination:** Removes `dead_wire` and intermediate aliases since they have no active path to `out_final`.
5. **Final Result:** `out_final = AND(AND(a, b), enable)` — exactly **5 logic gates $\rightarrow$ 2 logic gates (60% reduction)**, verified equivalent.

---

## Getting Started

### Prerequisites
- Node.js $\ge 18$
- npm $\ge 9$

### Installation
```bash
git clone https://github.com/Jayaadithya-cody/Circuit-DSL.git
cd Circuit-DSL
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
```

---

## Testing & Quality Assurance

The workbench is rigorously tested with **54 automated test suites** achieving **88.14%** statement coverage on `src/compiler`:

```bash
npm run test           # Run all 54 tests via Vitest
npm run coverage       # Generate detailed v8 coverage report
npm run lint           # Run ESLint 9 static analysis
npm run format         # Format repository with Prettier
npm run verify:verilog # Verify generated Verilog with iverilog
```

---

## Documentation

- **[Language Reference](docs/LANGUAGE.md)** — Grammar (EBNF), gate signatures, bus operations, sequential DFF conventions.
- **[Architectural Decisions](docs/DECISIONS.md)** — Engineering design records and compiler rationale.
- **[Defects Audit & Fixes](docs/AUDIT.md)** — Baseline defects D1–D11 root causes and verification evidence.
- **[Validation Report](VALIDATION.md)** — Complete test matrix, coverage metrics, and known limitations.
- **[Changelog](CHANGELOG.md)** — Historical log of all changes and features.

---

## Author & License

- **Author:** V. Jaya Adithya ([@Jayaadithya-cody](https://github.com/Jayaadithya-cody))
- **License:** [MIT License](LICENSE)
