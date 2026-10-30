# CircuitDSL Compiler Defects Audit (D1 - D11)

This audit documents the 11 critical defects identified in the baseline CircuitDSL compiler repository, including root causes, reproduction evidence, and proposed resolutions.

---

### D1. Dead Code Elimination (DCE) Preserves Dead User-Declared Wires
- **Severity:** High (Core Optimization Defect)
- **Root Cause:** In `OptimizationEngine.js`:
  ```javascript
  const needed = new Set(ast.expandedOutputs);
  instructions.forEach((inst) => {
    if (!inst.isTemporary) needed.add(inst.target);
  });
  ```
  Every non-temporary instruction target (any user-declared wire assignment) is unconditionally marked as `needed`.
- **Impact:** Any user wire (such as `dead_wire = XOR(a, b);` in the README `OptimizationDemo`) is never removed, even if nothing reads from it.
- **Reproduction Evidence:** Running the optimization test produces 10 initial instructions and 0 dead wires eliminated because `dead_wire` has `isTemporary: false`.
- **Fix:** Roots for DCE must strictly be primary circuit outputs (`ast.expandedOutputs`) and registered sequential state (DFF outputs).

---

### D2. Lack of Copy / Alias Propagation Blocks Full Reductions
- **Severity:** High (Optimization Failure)
- **Root Cause:** When `IRBuilder` creates intermediate wires for expressions and assigns them to variables via `BUF` instructions:
  - `cse_1 = BUF(_t2)`
  - `cse_2 = BUF(_t2)`
  - `const_wire = OR(cse_1, cse_2)`
  Because `cse_1` and `cse_2` are separate string names, the Boolean simplifier looking for `inst.args[0] === inst.args[1]` does not recognize `OR(cse_1, cse_2)` as `OR(_t2, _t2)`.
- **Impact:** The README `OptimizationDemo` fails to optimize to `out_final = AND(AND(a,b), enable)` (2 logic gates). Instead it remains at 10 instructions, causing the test suite assertion `expect(stats.initialGateCount).toBe(5)` to fail with 10.
- **Fix:** Add a transitive copy-propagation pass that resolves `BUF` aliases across all instructions before CSE and simplification.

---

### D3. Missing Boolean Algebraic Rewrites and Fixed-Point Pass Structure
- **Severity:** Medium (Optimization Gaps)
- **Root Cause:** `OptimizationEngine.js` only checked hardcoded binary cases:
  - `OR(a, a)` only checked `args[0] === args[1]` (fails for n-ary gates or swapped constants)
  - Missing identities: `AND(x, 1) -> x`, `AND(x, x) -> x`, `OR(x, 1) -> 1`, `XOR(x, x) -> 0`, `XOR(x, 0) -> x`, `XOR(x, 1) -> NOT(x)`, `NOT(NOT(x)) -> x`, `NOT(0) -> 1`, `NOT(1) -> 0`, NAND/NOR/XNOR constant rules, absorption `x & (x | y) -> x`.
  - No per-pass logging with structured snapshots for time machine inspection.
- **Fix:** Implement comprehensive algebraic rewrite rules over n-ary inputs, with a fixed-point multi-pass runner logging `{ pass, before, after, reason }`.

---

### D4. VerilogGenerator Emits Illegal / Non-Standard Verilog
- **Severity:** High (Hardware Synthesis Failure)
- **Root Cause:**
  - `VerilogGenerator.js` emitted illegal operators like `a ~& b` and `a ~| b` (invalid in IEEE 1364 Verilog; valid is `~(a & b)` and `~(a | b)`).
  - Bus elements emitted illegal wire declarations: `wire w[0];` (syntactically invalid; requires `wire [N-1:0] w;` or flattened `w_0`).
  - Constants emitted as raw `0` / `1` rather than sized literals `1'b0` / `1'b1`.
  - Sequential `DFF` emitted as simple `assign q = d_gated;` without clock sensitivity or `always @(posedge clk)` block.
- **Fix:** Rewrite `VerilogGenerator` to generate strictly valid IEEE 1364-2005 Verilog with proper operator grouping, sized literals, and behavioral clocked blocks for flip-flops.

---

### D5. DFF Accepted in Grammar but Evaluated as Constant 0 with No Sequential State
- **Severity:** High (Simulation Correctness)
- **Root Cause:** `Evaluator.js` evaluated `DFF` as `0` by default or ignored the clock entirely. `IRBuilder` did not distinguish sequential state from combinational gates.
- **Impact:** Clocked circuits could not be simulated across time; DFF circuits behaved identically to ground/zero.
- **Fix:** Implement clock edge simulation in `Evaluator.js`, track flip-flop state across simulation cycles, and validate DFF arity `DFF(d, clk [, reset])`.

---

### D6. No Combinational Loop Detection
- **Severity:** High (Compiler Crash / Infinite Loop / Silent Incorrectness)
- **Root Cause:** `Evaluator.js` evaluated signals iteratively using a fixed loop up to `N` iterations without cycle detection. Mutually dependent signals like `x = AND(a, y); y = NOT(x);` silently converged to arbitrary values or oscillated.
- **Fix:** Construct a signal dependency graph, detect cycles using DFS, report the exact cycle path as a compiler error, and evaluate acyclic combinational circuits in topological order.

---

### D7. Missing Arity & Signal Type Checking; Typo Cascades
- **Severity:** Medium (Developer Experience)
- **Root Cause:** Gate calls like `NOT(a, b)` or `ADN(a, b)` were not checked against an arity table. A single misspelled gate `ADN(a, b)` generated 8 cascading parser/analyzer errors.
- **Fix:** Add gate signature registry with min/max arity. Recognize `IDENT (` as function/gate call. Suggest correct gate with Levenshtein distance (e.g., `"Did you mean 'AND'?"`). Check bus bounds, unused wires, undriven wires.

---

### D8. Declarations Reported at Line 1, Col 1
- **Severity:** Low-Medium (Tooling / IDE UX)
- **Root Cause:** `SemanticAnalyzer.js` invoked `addSignal(name, 1, 1)` losing original token line and column numbers.
- **Fix:** Store full source ranges `{ startLine, startCol, endLine, endCol }` on AST nodes and propagate to all diagnostics.

---

### D9. Overlapping and Inconsistent Diagnostic Pipelines
- **Severity:** Medium (Architectural Technical Debt)
- **Root Cause:** Two disjoint diagnostic mechanisms: `diagnostics.js` ran naive regex matching over raw source code, while `ASTParser` and `SemanticAnalyzer` ran AST checks with differing error formats.
- **Fix:** Consolidate into a single pipeline where Lexer, Parser, and Semantic Analyzer generate unified `{ code, severity, range, message, explanation, suggestion, fix }` diagnostics. Add parser error recovery with synchronization on `;` and `}`. Support `/* ... */` block comments.

---

### D10. Hard-Coded Input States in UI
- **Severity:** Medium (UI Robustness)
- **Root Cause:** `App.jsx` initialized input values with hardcoded keys (`a`, `b`, `enable`, `in_a`, etc.).
- **Fix:** Dynamically initialize and maintain input states derived strictly from `ast.expandedInputs`.

---

### D11. Unused / Duplicated Keywords and Stale UI State
- **Severity:** Low (Code Hygiene)
- **Root Cause:** `TOKEN_TYPES` and keyword tables had duplicate and redundant entries. Compiler errors could leave previous simulation states displayed.
- **Fix:** Clean up keyword maps, make `Wire` type optional in DSL syntax, and ensure error states clear stale circuit graphs and outputs.
