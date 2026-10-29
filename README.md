# CircuitDSL Compiler & Visualization Workbench

A web-based digital logic compiler that transforms circuit descriptions into optimized intermediate representations, visual schematics, truth tables, and Verilog code.

## Overview

CircuitDSL combines compiler design with digital logic visualization in an interactive workbench. It allows users to write circuit programs, analyze their structure, explore optimization techniques, and visualize the resulting logic.

## Features

- **DSL Code Editor** — Write and edit digital circuit descriptions.
- **Lexical Analysis** — Convert source code into tokens.
- **Syntax Analysis** — Parse circuit programs and construct an Abstract Syntax Tree (AST).
- **Semantic Analysis** — Check signal declarations and supported semantic rules.
- **Compiler Diagnostics** — Display errors, source locations, explanations, and suggested corrections where supported.
- **Intermediate Representation (IR)** — Represent circuit operations in an intermediate form.
- **Code Optimization** — Explore dead-code elimination, common-subexpression elimination (CSE), and supported logic simplifications.
- **Circuit Visualization** — View the circuit as a graphical schematic.
- **Truth Table Generation** — Examine logical outputs for input combinations.
- **Verilog Generation** — Generate Verilog for supported circuit descriptions.
- **Interactive Simulation** — Experiment with circuit input values.

## Technology Stack

- React
- JavaScript
- Vite
- Tailwind CSS
- Lucide React

## Getting Started

### Prerequisites

Install [Node.js](https://nodejs.org/) and npm.

### Installation

Clone the repository and install its dependencies:

```bash
git clone https://github.com/Jayaadithya-cody/Circuit-DSL.git
cd Circuit-DSL
npm install
```

### Run the Application

```bash
npm run dev
```

Open the local URL displayed in your terminal.

### Production Build

```bash
npm run build
```

## Example: Optimization Demo

The following example demonstrates dead code, repeated expressions, and redundant logic.

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
    // Dead code: unused result
    dead_wire = XOR(a, b);
    // Common subexpression
    cse_1 = AND(a, b);
    cse_2 = AND(a, b);
    // Redundant logic: OR(x, x) = x
    const_wire = OR(cse_1, cse_2);
    // Primary output
    out_final = AND(const_wire, enable);
}
```

### Optimization Concepts

- **Dead-Code Elimination:** `dead_wire` is unused by the final output, so its calculation may be removed.
- **Common-Subexpression Elimination:** `cse_1` and `cse_2` compute the same expression, `AND(a, b)`, which may be shared.
- **Redundant Logic Simplification:** `OR(x, x)` is equivalent to `x`, so `const_wire` can be simplified.
- **Output Logic:** The final output combines the simplified expression with `enable`.
  The exact optimized output depends on the optimization passes implemented by the compiler.

## Compiler Workflow

1. Source code entry
2. Lexical analysis
3. Syntax analysis
4. Semantic analysis
5. Intermediate representation generation
6. Optimization
7. Circuit visualization and truth-table generation
8. Verilog generation

## Repository

**GitHub:** [Jayaadithya-cody/Circuit-DSL](https://github.com/Jayaadithya-cody/Circuit-DSL)

## Author

**V. Jaya Adithya**
[GitHub Profile](https://github.com/Jayaadithya-cody)

## License

No license has been specified. Add a `LICENSE` file if you intend to distribute the project under an open-source license.
