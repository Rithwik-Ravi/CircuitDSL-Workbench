import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { compile, OptimizationEngine, evaluateCircuitIR } from '../compiler/index.js';

describe('Property-Based Compiler Tests (V3)', () => {
  const gates = ['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR'];
  const varNames = ['a', 'b', 'c'];

  test('Optimizer preserves boolean equivalence on random combinational circuits', () => {
    // Generate random valid circuit with 3 inputs and 3-5 gate assignments
    const circuitArbitrary = fc.record({
      g1: fc.constantFrom(...gates),
      g2: fc.constantFrom(...gates),
      g3: fc.constantFrom(...gates),
      arg1_a: fc.constantFrom(...varNames),
      arg1_b: fc.constantFrom(...varNames),
      arg2_a: fc.constantFrom(...varNames),
      arg2_b: fc.constantFrom(...varNames),
      arg3_a: fc.constantFrom(...varNames),
      arg3_b: fc.constantFrom(...varNames),
    });

    fc.assert(
      fc.property(circuitArbitrary, (config) => {
        const dsl = `
          circuit RandomCircuit {
            input a: Wire;
            input b: Wire;
            input c: Wire;
            output y: Wire;
            wire w1: Wire;
            wire w2: Wire;

            w1 = ${config.g1 === 'NOT' ? `NOT(${config.arg1_a})` : `${config.g1}(${config.arg1_a}, ${config.arg1_b})`};
            w2 = ${config.g2 === 'NOT' ? `NOT(${config.arg2_a})` : `${config.g2}(${config.arg2_a}, ${config.arg2_b})`};
            y  = ${config.g3 === 'NOT' ? `NOT(w1)` : `${config.g3}(w1, w2)`};
          }
        `;

        const res = compile(dsl);
        if (res.hasErrors) return true; // skip ill-formed combinations

        // 1. Equivalence check
        expect(res.equivalence.equivalent).toBe(true);

        // 2. Gate count never increases
        expect(res.stats.optimizedGateCount).toBeLessThanOrEqual(res.stats.initialGateCount);

        // 3. Optimizer idempotence: optimizing an already optimized IR produces same gate count
        const secondPass = OptimizationEngine.optimize(res.optimizedIR, res.ast);
        expect(secondPass.stats.optimizedGateCount).toBe(res.stats.optimizedGateCount);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Topological evaluator matches direct boolean interpreter', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (aBool, bBool) => {
        const a = aBool ? 1 : 0;
        const b = bBool ? 1 : 0;

        const dsl = `
          circuit RefCheck {
            input a: Wire;
            input b: Wire;
            output y: Wire;
            y = AND(a, b);
          }
        `;
        const res = compile(dsl);
        const evalRes = evaluateCircuitIR(res.ir, { a, b });
        expect(evalRes.y).toBe(a & b);
        return true;
      }),
      { numRuns: 20 }
    );
  });
});
