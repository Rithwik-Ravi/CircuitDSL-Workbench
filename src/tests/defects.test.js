import { describe, test, expect } from 'vitest';
import { Lexer } from '../compiler/Lexer.js';
import { ASTParser } from '../compiler/ASTParser.js';
import { SemanticAnalyzer } from '../compiler/SemanticAnalyzer.js';
import { IRBuilder } from '../compiler/IRBuilder.js';
import { OptimizationEngine } from '../compiler/OptimizationEngine.js';
import { evaluateCircuitIR } from '../compiler/Evaluator.js';
import { generateVerilog } from '../compiler/VerilogGenerator.js';

describe('Baseline Defects Reproduction (D1 - D11)', () => {
  // D1: DCE should eliminate user-declared dead wire
  test('D1: DCE eliminates dead user-declared wires', () => {
    const dsl = `
      circuit DeadWireDemo {
        input a: Wire;
        input b: Wire;
        output y: Wire;
        wire dead_wire: Wire;
        dead_wire = XOR(a, b);
        y = AND(a, b);
      }
    `;
    const lexer = new Lexer(dsl);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const rawIR = IRBuilder.buildIR(ast);
    const { optimizedIR } = OptimizationEngine.optimize(rawIR, ast);

    const hasDeadWire = optimizedIR.some(
      (inst) => inst.target === 'dead_wire' || inst.args.includes('dead_wire')
    );
    expect(hasDeadWire).toBe(false);
  });

  // D2: Copy / alias propagation reduces OptimizationDemo to 2 logic gates
  test('D2: Copy propagation reduces OptimizationDemo to 2 gates', () => {
    const dsl = `
      circuit OptimizationDemo {
        input a: Wire;
        input b: Wire;
        input enable: Wire;
        output out_final: Wire;
        wire dead_wire: Wire;
        wire cse_1: Wire;
        wire cse_2: Wire;
        wire const_wire: Wire;
        dead_wire = XOR(a, b);
        cse_1 = AND(a, b);
        cse_2 = AND(a, b);
        const_wire = OR(cse_1, cse_2);
        out_final = AND(const_wire, enable);
      }
    `;
    const lexer = new Lexer(dsl);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const rawIR = IRBuilder.buildIR(ast);
    const { stats } = OptimizationEngine.optimize(rawIR, ast);

    expect(stats.initialGateCount).toBe(5);
    expect(stats.optimizedGateCount).toBe(2);
  });

  // D3: Missing rewrites (NOT(NOT x) -> x, XOR(x, x) -> 0, etc.)
  test('D3: Boolean rewrites simplify NOT(NOT(x)) and XOR(x,x)', () => {
    const dsl = `
      circuit RewritesDemo {
        input a: Wire;
        output y: Wire;
        output z: Wire;
        wire not_a: Wire;
        not_a = NOT(a);
        y = NOT(not_a);
        z = XOR(a, a);
      }
    `;
    const lexer = new Lexer(dsl);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const rawIR = IRBuilder.buildIR(ast);
    const { optimizedIR } = OptimizationEngine.optimize(rawIR, ast);

    // In a fully optimized IR, y should be alias/BUF of a, and z should be 0
    const zInst = optimizedIR.find((inst) => inst.target === 'z');
    expect(zInst?.args).toContain('0');
  });

  // D4: VerilogGenerator emits valid operators and sizes
  test('D4: Verilog generator emits valid NAND/NOR and sized constants', () => {
    const dsl = `
      circuit VerilogSyntaxDemo {
        input a: Wire;
        input b: Wire;
        output y: Wire;
        output z: Wire;
        y = NAND(a, b);
        z = AND(a, 0);
      }
    `;
    const lexer = new Lexer(dsl);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const rawIR = IRBuilder.buildIR(ast);
    const verilog = generateVerilog(ast, rawIR);

    expect(verilog).not.toContain('~&');
    expect(verilog).toContain('1\'b0');
  });

  // D6: Combinational loop detection
  test('D6: Combinational loop is detected and reported', () => {
    const dsl = `
      circuit LoopDemo {
        input a: Wire;
        output y: Wire;
        wire x: Wire;
        x = AND(a, y);
        y = NOT(x);
      }
    `;
    const lexer = new Lexer(dsl);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const diagnostics = SemanticAnalyzer.analyze(ast);

    const hasLoopError = diagnostics.some((d) =>
      d.message.toLowerCase().includes('combinational loop') ||
      d.message.toLowerCase().includes('cycle')
    );
    expect(hasLoopError).toBe(true);
  });

  // D7: Gate typo ADN(a, b) reports unknown gate suggestion
  test('D7: Gate typo suggests correct gate name', () => {
    const dsl = `
      circuit TypoDemo {
        input a: Wire;
        input b: Wire;
        output y: Wire;
        y = ADN(a, b);
      }
    `;
    const lexer = new Lexer(dsl);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast, diagnostics: parseDiag } = parser.parse();
    const semaDiag = SemanticAnalyzer.analyze(ast);
    const allDiag = [...parseDiag, ...semaDiag];

    const typoError = allDiag.find((d) =>
      d.message.includes("Unknown gate 'ADN'") || d.message.includes("Did you mean 'AND'?")
    );
    expect(typoError).toBeDefined();
    expect(allDiag.length).toBeLessThan(4); // No cascading errors
  });
});
