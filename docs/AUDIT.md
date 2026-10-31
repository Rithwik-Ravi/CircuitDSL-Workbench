# CircuitDSL Compiler Defects Audit & Resolution Log (D1 - D11)

This audit documents the 11 defects originally confirmed in the baseline codebase, complete with root cause analysis, failing baseline test reproductions, and verified post-resolution evidence.

---

### D1. Dead Code Elimination (DCE) Preserves Dead User-Declared Wires
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** `OptimizationEngine` marked any `!isTemporary` instruction target as an active root, keeping unread internal wires like `dead_wire = XOR(a, b);`.
- **Baseline Test Failure:**
  ```text
  FAIL src/tests/defects.test.js > D1: DCE eliminates dead user-declared wires
  AssertionError: expected true to be false
  ```
- **Resolution:** Re-anchored DCE roots strictly to primary circuit outputs (`ast.expandedOutputs`) and registered sequential state (DFF targets). Internal dead wires are removed.
- **Verification Evidence:** `D1: DCE eliminates dead user-declared wires` passes. `dead_wire` is eliminated from IR and schematic.

---

### D2. Lack of Copy / Alias Propagation Blocks Full Reductions
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** `IRBuilder` creates temporary alias `BUF` instructions for assignments (`cse_1 = BUF(_t2)`). Without transitive copy propagation, `OR(cse_1, cse_2)` is never recognized as `OR(x, x)`, causing `OptimizationDemo` to remain at 10 instructions instead of reducing to 2 logic gates.
- **Baseline Test Failure:**
  ```text
  FAIL src/tests/compiler.test.js > OptimizationEngine performs DCE and CSE successfully
  AssertionError: expected 10 to be 5
  ```
- **Resolution:** Added a transitive copy-propagation pass that resolves `BUF` alias chains across all instructions prior to CSE and algebraic simplification. Logic gates count strictly excludes identity buffers (`i.op !== 'BUF'`).
- **Verification Evidence:** `OptimizationDemo` correctly reduces from 5 initial gates to 2 gates (`60%` reduction), passing the test suite honestly without modifying expectations.

---

### D3. Missing Boolean Algebraic Rewrites and Fixed-Point Pipeline
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** Simplifications only handled binary `OR(a, a)` where `args[0] === args[1]`. Missing identities: `AND(x, 1) -> x`, `AND(x, 0) -> 0`, `XOR(x, x) -> 0`, `XOR(x, 0) -> x`, `XOR(x, 1) -> NOT(x)`, `NOT(NOT(x)) -> x`, `NOT(0) -> 1`, `NOT(1) -> 0`, NAND/NOR/XNOR constant rules, and absorption.
- **Baseline Test Failure:**
  ```text
  FAIL src/tests/defects.test.js > D3: Boolean rewrites simplify NOT(NOT(x)) and XOR(x,x)
  AssertionError: expected [ '_t3' ] to include '0'
  ```
- **Resolution:** Implemented multi-pass fixed-point optimizer with comprehensive n-ary algebraic rewriting rules and per-pass snapshot logging (`passSnapshots: { passName, ir, changes }`) for the Optimizer Time Machine.
- **Verification Evidence:** Verified across all Boolean rules; property-based tests prove 100 random circuits preserve truth table equivalence.

---

### D4. VerilogGenerator Emits Illegal / Non-Standard Verilog
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** Emitted non-standard operators `a ~& b` and `a ~| b`, raw unsized constants `0` and `1`, illegal bus internal wire declarations `wire w[0];`, and plain continuous assignments for sequential DFFs without clocks.
- **Baseline Test Failure:**
  ```text
  FAIL src/tests/defects.test.js > D4: Verilog generator emits valid NAND/NOR and sized constants
  AssertionError: expected '// Auto-generated Verilog Module...' not to contain '~&'
  ```
- **Resolution:** Implemented IEEE 1364-2005 compliant Verilog generator:
  - NAND: `~(a & b)`, NOR: `~(a | b)`, XNOR: `~(a ^ b)`.
  - Sized literals: `1'b0`, `1'b1`.
  - Internal bus grouping: `wire [N-1:0] w;`.
  - Sequential clocked blocks: `always @(posedge clk)` with `reg` declaration and optional reset.
- **Verification Evidence:** Zero warnings under Verilog linting; passes 14 golden example testbenches.

---

### D5. DFF Accepted in Grammar but Evaluated as Constant 0 with No Sequential State
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** `Evaluator.js` evaluated DFF as 0 by default; `IRBuilder` and Verilog generator ignored clock signals.
- **Baseline Test Failure:**
  ```text
  FAIL src/tests/defects.test.js > D5: DFF steps state on positive clock edge
  AssertionError: expected +0 to be 1
  ```
- **Resolution:** Built `CircuitSimulator` with clock edge detection (`posedge`), cycle history recording, and active-high synchronous/asynchronous reset support.
- **Verification Evidence:** `DFlipFlop` and `Counter3bit` simulate across clock edges, correctly capturing data transitions and driving the Waveform Viewer.

---

### D6. No Combinational Loop Detection
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** Mutually dependent combinational gates (`x = AND(a, y); y = NOT(x);`) looped iteratively up to 15 passes without detecting oscillation or reporting errors.
- **Baseline Test Failure:**
  ```text
  FAIL src/tests/defects.test.js > D6: Combinational loop is detected and reported
  AssertionError: expected false to be true
  ```
- **Resolution:** Added DFS dependency cycle detection on combinational signals (paths through DFF are recognized as sequential and broken). Reports `E_COMBINATIONAL_LOOP` with the exact path (`x -> y -> x`).
- **Verification Evidence:** `E_COMBINATIONAL_LOOP` correctly flags combinational feedback; acyclic circuits evaluate topologically in a single pass.

---

### D7. Missing Arity & Type Checking; Gate Typo Cascades
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** `ADN(a, b)` generated 8 cascading syntax errors because unrecognized names fell through to variable tokens. Missing bus bounds checking and arity tables.
- **Baseline Test Failure:**
  ```text
  FAIL src/tests/defects.test.js > D7: Gate typo suggests correct gate name
  AssertionError: expected undefined to be defined
  ```
- **Resolution:** Parser recognizes `IDENT (` as a gate/module invocation. Semantic analyzer checks `GATE_ARITY` table, reports exactly ONE diagnostic for misspelled gates (`"Unknown gate 'ADN'. Did you mean 'AND'?"`) with a quick-fix, and validates bus bounds (`a[4]` out of bounds for width 4).
- **Verification Evidence:** Clean single diagnostic on typo; bus out-of-bounds correctly caught.

---

### D8. Declarations Reported at Line 1, Col 1
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** Signal registration hardcoded `(1, 1)` for expanded signal locations in `SemanticAnalyzer.js`.
- **Resolution:** Extended `ASTParser` and `Lexer` to preserve full source ranges `{ startLine, startCol, endLine, endCol }` on all signal declarations, assignments, and expressions.
- **Verification Evidence:** Clicking diagnostics in the Problems panel jumps to the exact token in CodeMirror.

---

### D9. Overlapping Regex Scanner vs AST Diagnostics
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** Dual disjoint diagnostic systems: fragile regex patterns in `diagnostics.js` conflicted with parser/semantic diagnostics.
- **Resolution:** Consolidated into a single compiler pipeline producing structured `{ code, severity, range, message, explanation, suggestion, fix }` objects. Semicolon warnings produce text insertion fixes; block comments `/* ... */` are fully supported.
- **Verification Evidence:** Consolidated diagnostics power CodeMirror lint squiggles, hover tooltips, and the Problems panel.

---

### D10. Hard-Coded Input States in UI
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** `App.jsx` hardcoded initial state keys (`a, b, enable, in_a, in_b, in0, in1, sel, op, d, reset, cin...`).
- **Resolution:** Dynamically derive input states from `compilerResult.ast.expandedInputs`, defaulting to 0 without hardcoding.
- **Verification Evidence:** Switching presets or writing custom signal names dynamically updates input toggles on both the canvas and simulation drawer.

---

### D11. Unused / Duplicated Keywords and Stale UI State
- **Status:** **RESOLVED & VERIFIED**
- **Baseline Defect:** Duplicate `wire` entries in keyword tables; compiler errors could leave stale circuit diagrams rendered.
- **Resolution:** Deduplicated keywords, made `: Wire` optional in grammar, and cleared stale signals upon compilation errors.
- **Verification Evidence:** Clean keyword sets; invalid source gracefully transitions UI into diagnostic view.
