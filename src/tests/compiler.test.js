import { Lexer } from '../compiler/Lexer.js';
import { ASTParser } from '../compiler/ASTParser.js';
import { SemanticAnalyzer } from '../compiler/SemanticAnalyzer.js';
import { IRBuilder } from '../compiler/IRBuilder.js';
import { OptimizationEngine } from '../compiler/OptimizationEngine.js';
import { evaluateCircuitIR } from '../compiler/Evaluator.js';

describe('CircuitDSL Compiler Pipeline Tests', () => {
  const sampleDSL = `
    circuit TestOpt {
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

  test('Lexer tokenizes input without errors', () => {
    const lexer = new Lexer(sampleDSL);
    const { tokens, errors } = lexer.tokenize();
    expect(errors.length).toBe(0);
    expect(tokens.length).toBeGreaterThan(0);
  });

  test('ASTParser constructs correct AST structure', () => {
    const lexer = new Lexer(sampleDSL);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast, diagnostics } = parser.parse();
    expect(diagnostics.length).toBe(0);
    expect(ast.circuitName).toBe('TestOpt');
    expect(ast.inputs.length).toBe(3);
    expect(ast.outputs.length).toBe(1);
  });

  test('SemanticAnalyzer catches driven inputs and undefined wires', () => {
    const invalidDSL = `
      circuit Invalid {
        input a: Wire;
        output out: Wire;
        a = AND(a, b); // Invalid drive of input & undefined wire b
      }
    `;
    const lexer = new Lexer(invalidDSL);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const diagnostics = SemanticAnalyzer.analyze(ast);
    expect(
      diagnostics.some((d) => d.message.includes('Cannot drive input signal'))
    ).toBe(true);
    expect(
      diagnostics.some((d) => d.message.includes('Undefined signal reference'))
    ).toBe(true);
  });

  test('OptimizationEngine performs DCE and CSE successfully', () => {
    const lexer = new Lexer(sampleDSL);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const rawIR = IRBuilder.buildIR(ast);

    const { optimizedIR, stats } = OptimizationEngine.optimize(rawIR, ast);
    expect(stats.initialGateCount).toBe(5);
    expect(stats.optimizedGateCount).toBe(2);
    expect(stats.reductionPct).toBe(60);
  });

  test('Original and Optimized IR produce identical boolean truth table output', () => {
    const lexer = new Lexer(sampleDSL);
    const { tokens } = lexer.tokenize();
    const parser = new ASTParser(tokens);
    const { ast } = parser.parse();
    const rawIR = IRBuilder.buildIR(ast);
    const { optimizedIR } = OptimizationEngine.optimize(rawIR, ast);

    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let enable = 0; enable <= 1; enable++) {
          const inputs = { a, b, enable };
          const rawSignals = evaluateCircuitIR(rawIR, inputs);
          const optSignals = evaluateCircuitIR(optimizedIR, inputs);
          expect(optSignals.out_final).toBe(rawSignals.out_final);
        }
      }
    }
  });
});
