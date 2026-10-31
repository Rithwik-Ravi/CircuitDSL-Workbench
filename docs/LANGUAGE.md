# CircuitDSL Language Reference (v2)

CircuitDSL is a declarative hardware description domain-specific language designed for behavioral modeling, intermediate representation compilation, logic synthesis, and verification of combinational and sequential digital circuits.

---

## 1. Formal Grammar (EBNF)

```ebnf
CircuitProgram  ::= ( CircuitDecl | ModuleDecl )* EOF ;

CircuitDecl     ::= "circuit" Identifier "{" DeclarationOrStmt* "}" ;
ModuleDecl      ::= "module" Identifier "{" DeclarationOrStmt* "}" ;

DeclarationOrStmt ::= SignalDecl | Assignment ;

SignalDecl      ::= SignalKind Identifier ( "[" BusWidth "]" )? ( ":" TypeSpec )? ";" ;
SignalKind      ::= "input" | "output" | "wire" ;
BusWidth        ::= [1-9][0-9]* ;
TypeSpec        ::= "Wire" | "wire" ;

Assignment      ::= SignalRef "=" Expression ";" ;
SignalRef       ::= Identifier ( "[" [0-9]+ "]" )? ;

Expression      ::= GateInvocation
                  | SignalRef
                  | Constant
                  | "(" Expression ")" ;

GateInvocation  ::= GateName "(" ( Expression ( "," Expression )* )? ")" ;

GateName        ::= "AND" | "OR" | "XOR" | "NOT" | "NAND" | "NOR" | "XNOR" | "BUF" | "DFF" ;

Constant        ::= "0" | "1" ;
Identifier      ::= [A-Za-z_][A-Za-z0-9_]* ;
```

---

## 2. Gate Primitives & Arity Specifications

| Primitive | Minimum Arity | Maximum Arity | Semantics / Behavior |
| :--- | :---: | :---: | :--- |
| **`AND`** | 2 | $\infty$ (n-ary) | Bitwise AND: true iff all inputs are 1 |
| **`OR`** | 2 | $\infty$ (n-ary) | Bitwise OR: true iff at least one input is 1 |
| **`XOR`** | 2 | $\infty$ (n-ary) | Bitwise parity/XOR: odd parity among inputs |
| **`NOT`** | 1 | 1 | Boolean negation / inverter |
| **`NAND`** | 2 | $\infty$ (n-ary) | Inverted AND: $\neg \bigwedge x_i$ |
| **`NOR`** | 2 | $\infty$ (n-ary) | Inverted OR: $\neg \bigvee x_i$ |
| **`XNOR`** | 2 | $\infty$ (n-ary) | Inverted XOR / equivalence: $\neg \bigoplus x_i$ |
| **`BUF`** | 1 | 1 | Identity pass-through buffer / wire alias |
| **`DFF`** | 2 | 3 | Sequential D Flip-Flop: `DFF(d, clk [, reset])` |

---

## 3. Bus Signals & Indexing

- **Declaration:**
  ```text
  input a[4]: Wire;     // Declares a 4-bit bus: a[0], a[1], a[2], a[3]
  output sum[4]: Wire;
  wire carry[4]: Wire;
  ```
- **Index Bounds:** Buses are 0-indexed from `0` to `width - 1`. Out-of-bounds references produce compiler error `E_BUS_INDEX_OUT_OF_BOUNDS`.
- **Type Annotations:** The `: Wire` type annotation is optional. `input a;` is equivalent to `input a: Wire;`.

---

## 4. Sequential Semantics (DFF)

- **Signature:** `DFF(data, clock [, reset])`
- **Clock Edge:** Triggers strictly on the rising positive edge (`posedge`) of the clock signal.
- **Reset:** Optional active-high synchronous or asynchronous reset. When `reset == 1`, the flip-flop output synchronously clears to `0`.
- **Loop Breaking:** Flip-flops break pure combinational dependency cycles, enabling registered feedback loops (e.g. counters, shift registers, finite state machines).

---

## 5. Comments & Formatting

- Single-line comments start with `//` and extend to the end of the line.
- Multi-line block comments start with `/*` and terminate with `*/`.
- Statements terminate with a semicolon `;`. Missing semicolons generate `W_MISSING_SEMICOLON` with auto-fix text insertions.
