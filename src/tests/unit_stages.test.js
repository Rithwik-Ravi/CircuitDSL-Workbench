import { describe, test, expect } from 'vitest';
import {
  compile,
  Lexer,
  ASTParser,
  OptimizationEngine,
  checkEquivalence,
  mapToNandOnly,
  mapToNorOnly,
  QuineMcCluskey,
  analyzeSourceDiagnostics,
} from '../compiler/index.js';

describe('Unit Tests Per Stage (V1)', () => {
  // 1. Lexer
  describe('Lexer Stage', () => {
    test('tokenizes complex circuit with block comments and symbols', () => {
      const src = `/* Header */\ncircuit Test {\n  input a[4]: Wire;\n  // comment\n  output y: Wire;\n  y = AND(a[0], 1);\n}`;
      const lexer = new Lexer(src);
      const { tokens, errors } = lexer.tokenize();
      expect(errors.length).toBe(0);
      expect(tokens.length).toBeGreaterThan(10);
      expect(tokens[0].value).toBe('circuit');
      expect(tokens[0].line).toBe(2);
      expect(tokens[0].col).toBe(1);
    });

    test('catches unclosed block comments and illegal characters', () => {
      const srcComment = `circuit Bad {\n  /* unclosed comment\n  input a: Wire;\n}`;
      const lexer1 = new Lexer(srcComment);
      const res1 = lexer1.tokenize();
      expect(res1.errors.some((e) => e.code === 'E_UNCLOSED_COMMENT')).toBe(true);

      const srcChar = `circuit BadChar {\n  y = @;\n}`;
      const lexer2 = new Lexer(srcChar);
      const res2 = lexer2.tokenize();
      expect(res2.errors.some((e) => e.code === 'E_ILLEGAL_CHAR')).toBe(true);
    });
  });

  // 2. ASTParser & Error Recovery
  describe('ASTParser Stage', () => {
    test('parses buses, optional Wire, and multi-arg gates', () => {
      const src = `circuit Buses {\n  input a[4];\n  output y;\n  wire w[2];\n  y = XOR(a[0], a[1], a[2]);\n}`;
      const lexer = new Lexer(src);
      const { tokens } = lexer.tokenize();
      const parser = new ASTParser(tokens);
      const { ast, diagnostics } = parser.parse();

      expect(diagnostics.filter((d) => d.severity === 'error').length).toBe(0);
      expect(ast.inputs[0].width).toBe(4);
      expect(ast.expandedInputs.length).toBe(4);
      expect(ast.assignments[0].target).toBe('y');
    });

    test('synchronizes and recovers from missing tokens without crashing', () => {
      const src = `circuit Recovery {\n  input ;\n  output y: Wire;\n  y = ;\n  y = AND(a, b);\n}`;
      const lexer = new Lexer(src);
      const { tokens } = lexer.tokenize();
      const parser = new ASTParser(tokens);
      const { ast, diagnostics } = parser.parse();

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(ast.circuitName).toBe('Recovery');
    });
  });

  // 3. SemanticAnalyzer
  describe('SemanticAnalyzer Stage', () => {
    test('detects gate typos and suggests correction', () => {
      const src = `circuit Typo {\n  input a: Wire;\n  input b: Wire;\n  output y: Wire;\n  y = ADN(a, b);\n}`;
      const res = compile(src);
      const typo = res.diagnostics.find((d) => d.code === 'E_UNKNOWN_GATE');
      expect(typo).toBeDefined();
      expect(typo.message).toContain("Did you mean 'AND'?");
      expect(typo.fix?.replacement).toBe('AND');
    });

    test('validates bus bounds and arity', () => {
      const src = `circuit Bounds {\n  input a[2]: Wire;\n  output y: Wire;\n  y = NOT(a[0], a[1]);\n  wire w: Wire;\n  w = a[3];\n}`;
      const res = compile(src);
      expect(res.diagnostics.some((d) => d.code === 'E_GATE_ARITY_MISMATCH')).toBe(true);
      expect(res.diagnostics.some((d) => d.code === 'E_BUS_INDEX_OUT_OF_BOUNDS')).toBe(true);
    });

    test('detects combinational cycle with exact path', () => {
      const src = `circuit Loop {\n  input a: Wire;\n  output y: Wire;\n  wire w1: Wire;\n  wire w2: Wire;\n  w1 = AND(a, w2);\n  w2 = NOT(w1);\n  y = w1;\n}`;
      const res = compile(src);
      const loop = res.diagnostics.find((d) => d.code === 'E_COMBINATIONAL_LOOP');
      expect(loop).toBeDefined();
      expect(loop.message).toContain('w1 -> w2 -> w1');
    });
  });

  // 4. Optimization Passes
  describe('OptimizationEngine Passes', () => {
    test('Copy propagation resolves transitive aliases', () => {
      const ast = {
        circuitName: 'AliasTest',
        expandedInputs: ['in'],
        expandedOutputs: ['out'],
        expandedWires: ['w1', 'w2'],
      };
      const ir = [
        { target: 'w1', op: 'BUF', args: ['in'], isTemporary: false },
        { target: 'w2', op: 'BUF', args: ['w1'], isTemporary: false },
        { target: 'out', op: 'BUF', args: ['w2'], isTemporary: false },
      ];
      const { optimizedIR } = OptimizationEngine.optimize(ir, ast);
      const outInst = optimizedIR.find((i) => i.target === 'out');
      expect(outInst.args[0]).toBe('in');
    });

    test('Algebraic rewrites simplify various identities', () => {
      const dsl = `
        circuit Rewrites {\n          input a: Wire;\n          input b: Wire;\n          output y1: Wire;\n          output y2: Wire;\n          output y3: Wire;\n          output y4: Wire;\n          output y5: Wire;\n          output y6: Wire;\n          y1 = AND(a, 0);\n          y2 = AND(a, 1);\n          y3 = OR(b, 1);\n          y4 = OR(b, 0);\n          y5 = XOR(a, 0);\n          y6 = XOR(a, 1);\n        }
      `;
      const res = compile(dsl);
      expect(res.hasErrors).toBe(false);
      const outY1 = res.optimizedIR.find((i) => i.target === 'y1');
      const outY2 = res.optimizedIR.find((i) => i.target === 'y2');
      const outY3 = res.optimizedIR.find((i) => i.target === 'y3');
      const outY4 = res.optimizedIR.find((i) => i.target === 'y4');
      const outY5 = res.optimizedIR.find((i) => i.target === 'y5');

      expect(outY1.args).toContain('0');
      expect(outY2.args).toContain('a');
      expect(outY3.args).toContain('1');
      expect(outY4.args).toContain('b');
      expect(outY5.args).toContain('a');
    });
  });

  // 5. Verilog & Testbench Generator
  describe('Verilog Generation Stage', () => {
    test('emits standard Verilog and testbench', () => {
      const dsl = `
        circuit StdVerilog {\n          input a[2]: Wire;\n          output y: Wire;\n          y = NOR(a[0], a[1]);\n        }
      `;
      const res = compile(dsl);
      expect(res.verilog).toContain('module StdVerilog');
      expect(res.verilog).toContain('~(a[0] | a[1])');
      expect(res.verilog).not.toContain('~|');
      expect(res.testbench).toContain('module StdVerilog_tb');
      expect(res.testbench).toContain('uut (');
    });
  });

  // 6. Quine-McCluskey Minimizer & K-Map (Reverse Mode)
  describe('Quine-McCluskey & K-Map Stage', () => {
    test('minimizes 3-variable majority function: minterms 3, 5, 6, 7', () => {
      const vars = ['a', 'b', 'c'];
      const minterms = [3, 5, 6, 7]; // AB + BC + AC
      const result = QuineMcCluskey.minimize(vars, minterms);

      expect(result.essentialImplicants.length).toBe(3);
      expect(result.dslCode).toContain('circuit MinimizedCircuit');
      expect(result.verilogCode).toContain('assign out =');
      expect(result.kmap).toBeDefined();
      expect(result.kmap.grid.length).toBe(2);
      expect(result.kmap.grid[0].length).toBe(4);
    });

    test("handles 2-variable and 4-variable K-maps with don't cares", () => {
      const vars4 = ['a', 'b', 'c', 'd'];
      const minterms = [0, 1, 2];
      const dontCares = [3];
      const result = QuineMcCluskey.minimize(vars4, minterms, dontCares);

      expect(result.kmap.grid.length).toBe(4);
      expect(result.kmap.grid[0].length).toBe(4);
      expect(result.kmap.grid[0][2]).toBe('X'); // Gray order [0, 1, 3, 2] -> index 2 is col 3 (0011 = 3)
    });
  });

  // 7. Equivalence Checker
  describe('Equivalence Checker Stage', () => {
    test('confirms equivalence of optimized circuit', () => {
      const dsl = `
        circuit EquivProof {\n          input a: Wire;\n          input b: Wire;\n          output y: Wire;\n          wire w1: Wire;\n          wire w2: Wire;\n          w1 = AND(a, b);\n          w2 = AND(a, b);\n          y = OR(w1, w2);\n        }
      `;
      const res = compile(dsl);
      expect(res.equivalence.equivalent).toBe(true);
      expect(res.equivalence.counterexample).toBeNull();
      expect(res.equivalence.verifiedVectors).toBe(4);
    });

    test('handles large circuits with >16 inputs using random-sat check', () => {
      const dslWide = `
        circuit WideCircuit {
          input a[18]: Wire;
          output y: Wire;
          y = AND(a[0], a[1], a[2]);
        }
      `;
      const resWide = compile(dslWide);
      expect(resWide.equivalence.method).toBe('random-sat');
      expect(resWide.equivalence.equivalent).toBe(true);
    });

    test('detects intentional mismatch and generates counterexample', () => {
      const rawIR = [{ target: 'y', op: 'AND', args: ['a', 'b'], isTemporary: false }];
      const badIR = [{ target: 'y', op: 'OR', args: ['a', 'b'], isTemporary: false }];
      const ast = { expandedInputs: ['a', 'b'], expandedOutputs: ['y'] };
      const res = checkEquivalence(rawIR, badIR, ast);
      expect(res.equivalent).toBe(false);
      expect(res.counterexample).toBeDefined();
      expect(res.counterexample.failingOutput).toBe('y');
    });

    test('detects mismatch in sequential circuits', () => {
      const rawIR = [{ target: 'q', op: 'DFF', args: ['d', 'clk'], isTemporary: false }];
      const badIR = [{ target: 'q', op: 'BUF', args: ['0'], isTemporary: false }];
      const ast = { expandedInputs: ['d', 'clk'], expandedOutputs: ['q'] };
      const res = checkEquivalence(rawIR, badIR, ast);
      expect(res.equivalent).toBe(false);
    });
  });

  // 8. Technology Mapper (NAND-only & NOR-only)
  describe('Technology Mapper Stage', () => {
    test('maps all gate types to NAND-only logic', () => {
      const ir = [
        { target: 'w1', op: 'NOT', args: ['a'], isTemporary: true },
        { target: 'w2', op: 'AND', args: ['a', 'b'], isTemporary: true },
        { target: 'w3', op: 'OR', args: ['a', 'b'], isTemporary: true },
        { target: 'w4', op: 'NOR', args: ['a', 'b'], isTemporary: true },
        { target: 'w5', op: 'XOR', args: ['a', 'b'], isTemporary: true },
        { target: 'y', op: 'BUF', args: ['w5'], isTemporary: false },
      ];
      const nandMapped = mapToNandOnly(ir);
      expect(nandMapped.every((i) => i.op === 'NAND' || i.op === 'BUF')).toBe(true);
    });

    test('maps all gate types to NOR-only logic', () => {
      const ir = [
        { target: 'w1', op: 'NOT', args: ['a'], isTemporary: true },
        { target: 'w2', op: 'OR', args: ['a', 'b'], isTemporary: true },
        { target: 'w3', op: 'AND', args: ['a', 'b'], isTemporary: true },
        { target: 'y', op: 'BUF', args: ['w3'], isTemporary: false },
      ];
      const norMapped = mapToNorOnly(ir);
      expect(norMapped.every((i) => i.op === 'NOR' || i.op === 'BUF')).toBe(true);
    });
  });

  // 9. Metrics Stage
  describe('Metrics Stage', () => {
    test('computes logic depth, transistor count, and savings', () => {
      const dsl = `
        circuit MetricDemo {\n          input a: Wire;\n          input b: Wire;\n          output y: Wire;\n          wire w: Wire;\n          w = AND(a, b);\n          y = NOT(w);\n        }
      `;
      const res = compile(dsl);
      expect(res.metrics).toBeDefined();
      expect(res.metrics.raw.gateCount).toBeGreaterThan(0);
      expect(res.metrics.raw.transistorCount).toBeGreaterThan(0);
      expect(res.metrics.raw.logicDepth).toBe(2);
    });
  });

  // 10. Fallback Delimiter Scanner
  describe('Fallback Source Diagnostics', () => {
    test('flags mismatched and unclosed delimiters in source', () => {
      const diags1 = analyzeSourceDiagnostics('circuit Foo { ( ] }');
      expect(diags1.some((d) => d.code === 'E_UNEXPECTED_DELIMITER')).toBe(true);

      const diags2 = analyzeSourceDiagnostics('circuit Bar { ( ');
      expect(diags2.some((d) => d.code === 'E_UNCLOSED_DELIMITER')).toBe(true);
    });
  });

  // 11. Quine-McCluskey Edge Cases
  describe('Quine-McCluskey Edge Cases', () => {
    test('handles constant 0 (empty minterms) and constant 1 (all minterms)', () => {
      const res0 = QuineMcCluskey.minimize(['a', 'b'], []);
      expect(res0.dslCode).toContain('out = 0');
      expect(res0.verilogCode).toContain("1'b0");

      const res1 = QuineMcCluskey.minimize(['a', 'b'], [0, 1, 2, 3]);
      expect(res1.dslCode).toContain('out = 1');
      expect(res1.verilogCode).toContain("1'b1");
    });
  });
});
